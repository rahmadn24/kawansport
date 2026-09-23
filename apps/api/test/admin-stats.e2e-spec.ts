process.env.DB_DRIVER = 'sqljs';
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '7d';
// Hindari panggilan jaringan ke FCM selama e2e.
process.env.FIREBASE_STUB = 'true';
// Paksa mode stub Midtrans (tanpa network/key).
process.env.MIDTRANS_SERVER_KEY = '';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { User } from '../src/users/user.entity';
import { Booking } from '../src/bookings/booking.entity';
import { ShopOrder } from '../src/marketplace/shop-order.entity';

describe('Admin Stats (e2e)', () => {
  let app: INestApplication;
  let users: Repository<User>;
  let bookings: Repository<Booking>;
  let orders: Repository<ShopOrder>;
  const ts = Date.now();
  const password = 'Password123!';

  let adminToken: string;
  let userToken: string;
  let userId: string;

  const DATE = '2030-06-17';
  const ALL_DAYS_OPEN = {
    mon: ['08:00-11:00'],
    tue: ['08:00-11:00'],
    wed: ['08:00-11:00'],
    thu: ['08:00-11:00'],
    fri: ['08:00-11:00'],
    sat: ['08:00-11:00'],
    sun: ['08:00-11:00'],
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
    bookings = app.get<Repository<Booking>>(getRepositoryToken(Booking));
    orders = app.get<Repository<ShopOrder>>(getRepositoryToken(ShopOrder));

    // Seed admin (register lalu naikkan role via repository).
    const adminEmail = `stats_admin_${ts}@example.com`;
    const regAdmin = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: adminEmail, password })
      .expect(201);
    await users.update(
      { id: regAdmin.body.user.id },
      { role: 'super_admin' },
    );
    adminToken = await login(adminEmail);
    const authAdmin = () => ({ Authorization: `Bearer ${adminToken}` });

    // Seed venue owner.
    const ownerEmail = `stats_owner_${ts}@example.com`;
    const regOwner = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: ownerEmail, password })
      .expect(201);
    await users.update(
      { id: regOwner.body.user.id },
      { role: 'venue_owner' },
    );
    const ownerToken = await login(ownerEmail);
    const authOwner = () => ({ Authorization: `Bearer ${ownerToken}` });

    // Seed regular user.
    const userEmail = `stats_user_${ts}@example.com`;
    const regUser = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: userEmail, password })
      .expect(201);
    userToken = regUser.body.accessToken as string;
    userId = regUser.body.user.id as string;
    const authUser = () => ({ Authorization: `Bearer ${userToken}` });

    // Seed venue (owner: pending) + approve (admin) + court.
    const venue = await request(app.getHttpServer())
      .post('/venues')
      .set(authOwner())
      .send({
        name: 'Stats Court',
        address: 'Jl. Test',
        lat: -6.2,
        lng: 106.8,
        sports: ['Futsal'],
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/venues/${venue.body.id}/approve`)
      .set(authAdmin())
      .expect(201);

    const court = await request(app.getHttpServer())
      .post(`/venues/${venue.body.id}/courts`)
      .set(authOwner())
      .send({
        sport: 'Futsal',
        name: 'Court A',
        pricePerHour: 100000,
        openHours: ALL_DAYS_OPEN,
      })
      .expect(201);

    // Seed booking paid: buat via API (pending) lalu tandai paid via repository.
    const booking = await request(app.getHttpServer())
      .post('/bookings')
      .set(authUser())
      .send({ courtId: court.body.id, date: DATE, start: '08:00' })
      .expect(201);
    expect(booking.body.amount).toBe(102500);
    await bookings.update(
      { id: booking.body.id },
      { status: 'paid', paidAt: new Date() },
    );

    // Seed order paid via repository (tanpa webhook Midtrans).
    await orders.save({
      userId,
      paymentRef: `MP-TEST-${ts}`,
      channel: 'marketplace',
      status: 'paid',
      total: 50000,
      paidAt: new Date(),
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('401 tanpa token', () =>
    request(app.getHttpServer()).get('/admin/stats').expect(401));

  it('403 user biasa', () =>
    request(app.getHttpServer())
      .get('/admin/stats')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403));

  it('200 super_admin + struktur benar', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('range');
    expect(res.body.users).toHaveProperty('total');
    expect(res.body.users).toHaveProperty('byRole');
    expect(res.body.venues).toHaveProperty('approved');
    expect(res.body.bookings).toHaveProperty('gmv');
    expect(res.body.orders).toHaveProperty('gmv');
    expect(res.body.topSports).toBeInstanceOf(Array);

    // minimal seed values
    expect(res.body.users.total).toBeGreaterThanOrEqual(3);
    expect(res.body.venues.approved).toBeGreaterThanOrEqual(1);
    expect(res.body.bookings.paid).toBeGreaterThanOrEqual(1);
    expect(res.body.bookings.gmv).toBeGreaterThanOrEqual(100000);
    expect(res.body.orders.paid).toBeGreaterThanOrEqual(1);
    expect(res.body.orders.gmv).toBeGreaterThanOrEqual(50000);
  });

  it('filter range from/to', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/stats')
      .query({ from: '2000-01-01', to: '2000-01-02' })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.bookings.total).toBe(0);
    expect(res.body.orders.total).toBe(0);
  });

  it('from/to invalid -> 400', async () => {
    await request(app.getHttpServer())
      .get('/admin/stats')
      .query({ from: 'not-a-date' })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
    await request(app.getHttpServer())
      .get('/admin/stats')
      .query({ to: 'yesterday-ish' })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
  });
});
