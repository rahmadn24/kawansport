process.env.DB_DRIVER = 'sqljs';
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '7d';
process.env.MIDTRANS_SERVER_KEY = '';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Booking } from '../src/bookings/booking.entity';
import { ShopOrder } from '../src/marketplace/shop-order.entity';
import { User } from '../src/users/user.entity';
import { Voucher, VoucherRedemption } from '../src/vouchers/voucher.entity';

describe('Activity feed API-W04 (e2e)', () => {
  let app: INestApplication;
  let users: Repository<User>;
  let orders: Repository<ShopOrder>;
  let vouchers: Repository<Voucher>;
  let redemptions: Repository<VoucherRedemption>;
  const ts = Date.now();
  const password = 'Password123!';

  let userToken: string;
  let userId: string;
  let ownerToken: string;
  let adminToken: string;
  let courtId: string;

  const DATE = '2030-09-20';
  const ALL_DAYS_OPEN = {
    mon: ['08:00-18:00'],
    tue: ['08:00-18:00'],
    wed: ['08:00-18:00'],
    thu: ['08:00-18:00'],
    fri: ['08:00-18:00'],
    sat: ['08:00-18:00'],
    sun: ['08:00-18:00'],
  };

  const login = async (email: string) =>
    (
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(200)
    ).body.accessToken as string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    users = app.get<Repository<User>>(getRepositoryToken(User));
    orders = app.get<Repository<ShopOrder>>(getRepositoryToken(ShopOrder));
    vouchers = app.get<Repository<Voucher>>(getRepositoryToken(Voucher));
    redemptions = app.get<Repository<VoucherRedemption>>(
      getRepositoryToken(VoucherRedemption),
    );

    const regUser = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `act_user_${ts}@example.com`, password })
      .expect(201);
    userToken = regUser.body.accessToken as string;
    userId = regUser.body.user.id as string;

    const regOwner = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `act_owner_${ts}@example.com`, password })
      .expect(201);
    await users.update(
      { id: regOwner.body.user.id },
      { role: 'venue_owner' },
    );
    ownerToken = await login(`act_owner_${ts}@example.com`);

    const regAdmin = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `act_admin_${ts}@example.com`, password })
      .expect(201);
    await users.update(
      { id: regAdmin.body.user.id },
      { role: 'super_admin' },
    );
    adminToken = await login(`act_admin_${ts}@example.com`);

    const venue = await request(app.getHttpServer())
      .post('/venues')
      .set({ Authorization: `Bearer ${ownerToken}` })
      .send({
        name: 'GOR Activity',
        address: 'Jl. Feed No. 4',
        lat: -6.2,
        lng: 106.8,
        sports: ['Futsal'],
      })
      .expect(201);
    const court = await request(app.getHttpServer())
      .post(`/venues/${venue.body.id}/courts`)
      .set({ Authorization: `Bearer ${ownerToken}` })
      .send({
        sport: 'Futsal',
        name: 'Lapangan Feed',
        pricePerHour: 100000,
        openHours: ALL_DAYS_OPEN,
      })
      .expect(201);
    courtId = court.body.id;

    // Fixture booking_paid + booking_checkin (walk-in lalu check-in).
    const walkin = await request(app.getHttpServer())
      .post('/bookings/walk-in')
      .set({ Authorization: `Bearer ${ownerToken}` })
      .send({ courtId, date: DATE, start: '08:00', buyerName: 'Feed Guy' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/bookings/${walkin.body.id}/check-in`)
      .set({ Authorization: `Bearer ${ownerToken}` })
      .expect(200);

    // Fixture order_paid (insert langsung, paidAt = sekarang).
    await orders.save(
      orders.create({
        userId,
        paymentRef: `MP-ACT-${ts}`,
        channel: 'marketplace',
        status: 'paid',
        total: 75000,
        subtotal: 75000,
        discount: 0,
        pointsUsed: 0,
        paidAt: new Date(),
      }),
    );

    // Fixture voucher_redeem.
    const voucher = await vouchers.save(
      vouchers.create({ code: `ACT${String(ts).slice(-6)}`, type: 'fixed', value: 5000 }),
    );
    const bookingRepo = app.get<Repository<Booking>>(
      getRepositoryToken(Booking),
    );
    const paidBooking = await bookingRepo.findOneOrFail({
      where: { id: walkin.body.id },
    });
    await redemptions.save(
      redemptions.create({
        voucherId: voucher.id,
        userId,
        bookingId: paidBooking.id,
        discount: 5000,
      }),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('tanpa token -> 401; user biasa -> 403', async () => {
    await request(app.getHttpServer()).get('/admin/activity').expect(401);
    await request(app.getHttpServer())
      .get('/admin/activity')
      .set({ Authorization: `Bearer ${userToken}` })
      .expect(403);
  });

  it('memuat semua tipe event + urutan waktu desc', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/activity')
      .set({ Authorization: `Bearer ${adminToken}` })
      .expect(200);
    const items = res.body.data as Array<{
      type: string;
      at: string;
      title: string;
      refType?: string;
      refId?: string;
    }>;
    expect(items.length).toBeGreaterThan(0);
    const types = new Set(items.map((i) => i.type));
    for (const t of [
      'booking_paid',
      'booking_checkin',
      'order_paid',
      'user_joined',
      'voucher_redeem',
    ]) {
      expect(types.has(t)).toBe(true);
    }
    // Bentuk tiap item.
    for (const i of items) {
      expect(typeof i.type).toBe('string');
      expect(new Date(i.at).getTime()).not.toBeNaN();
      expect(typeof i.title).toBe('string');
    }
    // Judul booking lunas sesuai spec.
    expect(
      items.find((i) => i.type === 'booking_paid')?.title,
    ).toBe('Booking lunas');
    // Urutan desc.
    const times = items.map((i) => new Date(i.at).getTime());
    const sorted = [...times].sort((a, b) => b - a);
    expect(times).toEqual(sorted);
  });

  it('limit dihormati (default 20, maks 100)', async () => {
    const limited = await request(app.getHttpServer())
      .get('/admin/activity')
      .set({ Authorization: `Bearer ${adminToken}` })
      .query({ limit: 2 })
      .expect(200);
    expect((limited.body.data as unknown[]).length).toBe(2);

    const def = await request(app.getHttpServer())
      .get('/admin/activity')
      .set({ Authorization: `Bearer ${adminToken}` })
      .expect(200);
    expect((def.body.data as unknown[]).length).toBeLessThanOrEqual(20);

    await request(app.getHttpServer())
      .get('/admin/activity')
      .set({ Authorization: `Bearer ${adminToken}` })
      .query({ limit: 101 })
      .expect(400);
  });
});
