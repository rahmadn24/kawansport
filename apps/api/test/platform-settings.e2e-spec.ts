process.env.DB_DRIVER = 'sqljs';
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '7d';
// Paksa mode stub Midtrans (tanpa network/key): signature dihitung dengan key kosong.
process.env.MIDTRANS_SERVER_KEY = '';

import { createHash } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { User } from '../src/users/user.entity';

function sign(orderId: string, statusCode: string, grossAmount: string): string {
  return createHash('sha512')
    .update(`${orderId}${statusCode}${grossAmount}`)
    .digest('hex');
}

describe('Platform Settings API-W03 (e2e)', () => {
  let app: INestApplication;
  let users: Repository<User>;
  const ts = Date.now();
  const password = 'Password123!';

  let adminToken: string;
  let buyerToken: string;
  let courtId: string;

  const DATE = '2030-08-12';
  const OPEN = {
    mon: ['08:00-18:00'],
    tue: ['08:00-18:00'],
    wed: ['08:00-18:00'],
    thu: ['08:00-18:00'],
    fri: ['08:00-18:00'],
    sat: ['08:00-18:00'],
    sun: ['08:00-18:00'],
  };

  const authAdmin = () => ({ Authorization: `Bearer ${adminToken}` });
  const authBuyer = () => ({ Authorization: `Bearer ${buyerToken}` });

  const login = async (email: string) =>
    (
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(200)
    ).body.accessToken as string;

  const getSettings = () =>
    request(app.getHttpServer()).get('/admin/settings').set(authAdmin());

  const byKey = (body: {
    data: Array<{ key: string; value: unknown }>;
  }): Record<string, unknown> =>
    Object.fromEntries(body.data.map((s) => [s.key, s.value]));

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

    const regAdmin = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `w03_admin_${ts}@example.com`, password })
      .expect(201);
    await users.update({ id: regAdmin.body.user.id }, { role: 'super_admin' });
    adminToken = await login(`w03_admin_${ts}@example.com`);

    const regOwner = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `w03_owner_${ts}@example.com`, password })
      .expect(201);
    await users.update({ id: regOwner.body.user.id }, { role: 'venue_owner' });
    const ownerToken = await login(`w03_owner_${ts}@example.com`);

    buyerToken = (
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: `w03_buyer_${ts}@example.com`, password })
        .expect(201)
    ).body.accessToken;

    const venue = await request(app.getHttpServer())
      .post('/venues')
      .set({ Authorization: `Bearer ${ownerToken}` })
      .send({
        name: 'GOR W03',
        address: 'Jl. Settings No. 3',
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
        name: 'Lapangan Fee',
        pricePerHour: 100000,
        openHours: OPEN,
      })
      .expect(201);
    courtId = court.body.id;
  });

  it('GET /admin/settings tanpa token -> 401; non-admin -> 403', async () => {
    await request(app.getHttpServer()).get('/admin/settings').expect(401);
    await request(app.getHttpServer())
      .get('/admin/settings')
      .set(authBuyer())
      .expect(403);
  });

  it('PUT /admin/settings non-admin -> 403', async () => {
    await request(app.getHttpServer())
      .put('/admin/settings')
      .set(authBuyer())
      .send({ service_fee_amount: 9999 })
      .expect(403);
  });

  it('GET /admin/settings -> defaults ter-seed + values terparse', async () => {
    const res = await getSettings().expect(200);
    expect(res.body.meta.total).toBe(5);
    const map = byKey(res.body);
    expect(map.service_fee_enabled).toBe(true);
    expect(map.service_fee_amount).toBe(2500);
    expect(map.commission_percent).toBe(5);
    expect(map.commission_promo_percent).toBeNull();
    expect(map.commission_promo_until).toBeNull();
    for (const item of res.body.data as Array<{
      key: string;
      raw: unknown;
      updatedAt: unknown;
    }>) {
      expect(item.key).toBeDefined();
      expect(item).toHaveProperty('raw');
      expect(item).toHaveProperty('updatedAt');
    }
  });

  it('PUT: key asing -> 400; body kosong -> 400', async () => {
    await getSettings();
    await request(app.getHttpServer())
      .put('/admin/settings')
      .set(authAdmin())
      .send({ service_fee_hack: 1 })
      .expect(400);
    await request(app.getHttpServer())
      .put('/admin/settings')
      .set(authAdmin())
      .send({})
      .expect(400);
  });

  it('PUT: validasi per kunci (fee negatif, percent >100, tanggal invalid) -> 400', async () => {
    await request(app.getHttpServer())
      .put('/admin/settings')
      .set(authAdmin())
      .send({ service_fee_amount: -1 })
      .expect(400);
    await request(app.getHttpServer())
      .put('/admin/settings')
      .set(authAdmin())
      .send({ commission_percent: 101 })
      .expect(400);
    await request(app.getHttpServer())
      .put('/admin/settings')
      .set(authAdmin())
      .send({ commission_promo_percent: 150 })
      .expect(400);
    await request(app.getHttpServer())
      .put('/admin/settings')
      .set(authAdmin())
      .send({ commission_promo_until: 'bukan-tanggal' })
      .expect(400);
    await request(app.getHttpServer())
      .put('/admin/settings')
      .set(authAdmin())
      .send({ service_fee_enabled: 'mungkin' })
      .expect(400);
  });

  it('PUT: komisi + promo valid tersimpan dan terbaca kembali', async () => {
    const until = '2031-01-01T00:00:00.000Z';
    const res = await request(app.getHttpServer())
      .put('/admin/settings')
      .set(authAdmin())
      .send({
        commission_percent: 7,
        commission_promo_percent: 3,
        commission_promo_until: until,
      })
      .expect(200);
    const map = byKey(res.body);
    expect(map.commission_percent).toBe(7);
    expect(map.commission_promo_percent).toBe(3);
    expect(map.commission_promo_until).toBe(
      new Date(until).toISOString(),
    );
  });

  it('fee default ON: booking amount = subtotal + 2500; webhook final -> paid', async () => {
    // Pastikan fee kembali default untuk test ini.
    await request(app.getHttpServer())
      .put('/admin/settings')
      .set(authAdmin())
      .send({ service_fee_enabled: true, service_fee_amount: 2500 })
      .expect(200);

    const res = await request(app.getHttpServer())
      .post('/bookings')
      .set(authBuyer())
      .send({ courtId, date: DATE, start: '08:00' })
      .expect(201);
    expect(res.body.subtotal).toBe(100000);
    expect(res.body.serviceFee).toBe(2500);
    expect(res.body.amount).toBe(102500);

    const statusCode = '200';
    const grossAmount = String(res.body.amount);
    const paid = await request(app.getHttpServer())
      .post('/payments/midtrans/notification')
      .send({
        order_id: res.body.paymentRef,
        status_code: statusCode,
        gross_amount: grossAmount,
        signature_key: sign(res.body.paymentRef, statusCode, grossAmount),
        transaction_status: 'settlement',
      })
      .expect(200);
    expect(paid.body.status).toBe('paid');
  });

  it('toggle fee OFF: booking total tanpa fee; webhook gross_amount final -> paid', async () => {
    await request(app.getHttpServer())
      .put('/admin/settings')
      .set(authAdmin())
      .send({ service_fee_enabled: false })
      .expect(200);

    const check = await getSettings().expect(200);
    expect(byKey(check.body).service_fee_enabled).toBe(false);

    const res = await request(app.getHttpServer())
      .post('/bookings')
      .set(authBuyer())
      .send({ courtId, date: DATE, start: '09:00' })
      .expect(201);
    expect(res.body.subtotal).toBe(100000);
    expect(res.body.serviceFee).toBe(0);
    expect(res.body.amount).toBe(100000);

    const statusCode = '200';
    const grossAmount = String(res.body.amount);
    const paid = await request(app.getHttpServer())
      .post('/payments/midtrans/notification')
      .send({
        order_id: res.body.paymentRef,
        status_code: statusCode,
        gross_amount: grossAmount,
        signature_key: sign(res.body.paymentRef, statusCode, grossAmount),
        transaction_status: 'settlement',
      })
      .expect(200);
    expect(paid.body.status).toBe('paid');
  });

  it('fee custom 3000: booking amount = subtotal + fee', async () => {
    await request(app.getHttpServer())
      .put('/admin/settings')
      .set(authAdmin())
      .send({ service_fee_enabled: true, service_fee_amount: 3000 })
      .expect(200);

    const res = await request(app.getHttpServer())
      .post('/bookings')
      .set(authBuyer())
      .send({ courtId, date: DATE, start: '10:00' })
      .expect(201);
    expect(res.body.serviceFee).toBe(3000);
    expect(res.body.amount).toBe(103000);
  });

  afterAll(async () => {
    await app.close();
  });
});
