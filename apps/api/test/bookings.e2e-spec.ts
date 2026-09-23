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
import { Booking } from '../src/bookings/booking.entity';
import { User } from '../src/users/user.entity';

function sign(orderId: string, statusCode: string, grossAmount: string): string {
  return createHash('sha512')
    .update(`${orderId}${statusCode}${grossAmount}`)
    .digest('hex');
}

describe('Bookings BK-03 (e2e)', () => {
  let app: INestApplication;
  let users: Repository<User>;
  let bookings: Repository<Booking>;
  const ts = Date.now();
  const password = 'Password123!';

  let ownerToken: string;
  let userToken: string;
  let otherToken: string;
  let courtId: string;

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

  const authOwner = () => ({ Authorization: `Bearer ${ownerToken}` });
  const authUser = () => ({ Authorization: `Bearer ${userToken}` });
  const authOther = () => ({ Authorization: `Bearer ${otherToken}` });

  async function slotStatus(start: string): Promise<string | undefined> {
    const res = await request(app.getHttpServer())
      .get(`/courts/${courtId}/availability`)
      .set(authUser())
      .query({ date: DATE })
      .expect(200);
    return (
      res.body.slots as Array<{ start: string; status: string }>
    ).find((s) => s.start === start)?.status;
  }

  function notif(
    booking: { paymentRef: string; amount: number },
    transactionStatus: string,
    extra: Record<string, string> = {},
  ) {
    const statusCode = '200';
    const grossAmount = String(booking.amount);
    return {
      order_id: booking.paymentRef,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: sign(booking.paymentRef, statusCode, grossAmount),
      transaction_status: transactionStatus,
      ...extra,
    };
  }

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

    const regOwner = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `bk03_owner_${ts}@example.com`, password })
      .expect(201);
    const ownerId = regOwner.body.user.id as string;
    await users.update({ id: ownerId }, { role: 'venue_owner' });
    ownerToken = (
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: `bk03_owner_${ts}@example.com`, password })
        .expect(200)
    ).body.accessToken;

    const regUser = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `bk03_user_${ts}@example.com`, password })
      .expect(201);
    userToken = regUser.body.accessToken as string;

    const regOther = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `bk03_other_${ts}@example.com`, password })
      .expect(201);
    otherToken = regOther.body.accessToken as string;

    const venue = await request(app.getHttpServer())
      .post('/venues')
      .set(authOwner())
      .send({
        name: 'GOR BK03',
        address: 'Jl. Booking No. 3',
        lat: -6.2,
        lng: 106.8,
        sports: ['Futsal'],
      })
      .expect(201);

    const court = await request(app.getHttpServer())
      .post(`/venues/${venue.body.id}/courts`)
      .set(authOwner())
      .send({
        sport: 'Futsal',
        name: 'Lapangan Booking',
        pricePerHour: 100000,
        openHours: ALL_DAYS_OPEN,
      })
      .expect(201);
    courtId = court.body.id;
  });

  it('POST /bookings tanpa token -> 401', async () => {
    await request(app.getHttpServer())
      .post('/bookings')
      .send({ courtId, date: DATE, start: '08:00' })
      .expect(401);
  });

  it('booking sukses -> pending + snap stub + slot booked', async () => {
    const res = await request(app.getHttpServer())
      .post('/bookings')
      .set(authUser())
      .send({ courtId, date: DATE, start: '08:00' })
      .expect(201);
    expect(res.body.status).toBe('pending');
    expect(res.body.amount).toBe(102500);
    expect(res.body.serviceFee).toBe(2500);
    expect(res.body.paymentRef).toMatch(/^BK-/);
    expect(res.body.snapToken).toMatch(/^stub-snap-/);
    expect(res.body.redirectUrl).toContain(res.body.paymentRef);
    expect(await slotStatus('08:00')).toBe('booked');
  });

  it('booking slot sama -> 409; slot beda tetap bisa', async () => {
    await request(app.getHttpServer())
      .post('/bookings')
      .set(authOther())
      .send({ courtId, date: DATE, start: '08:00' })
      .expect(409);

    const ok = await request(app.getHttpServer())
      .post('/bookings')
      .set(authOther())
      .send({ courtId, date: DATE, start: '09:00' })
      .expect(201);
    expect(ok.body.status).toBe('pending');
  });

  it('webhook settlement -> paid; double-hit idempotent', async () => {
    const mine = await request(app.getHttpServer())
      .get('/bookings/me')
      .set(authUser())
      .expect(200);
    const booking = (
      mine.body.data as Array<{ paymentRef: string; amount: number; start: string }>
    ).find((b) => b.start === '08:00');
    expect(booking).toBeDefined();

    const first = await request(app.getHttpServer())
      .post('/payments/midtrans/notification')
      .send(notif(booking!, 'settlement'))
      .expect(200);
    expect(first.body.status).toBe('paid');

    const second = await request(app.getHttpServer())
      .post('/payments/midtrans/notification')
      .send(notif(booking!, 'settlement'))
      .expect(200);
    expect(second.body.status).toBe('paid');

    const detail = await request(app.getHttpServer())
      .get('/bookings/me')
      .set(authUser())
      .expect(200);
    const paid = (detail.body.data as Array<{ paymentRef: string; status: string }>).find(
      (b) => b.paymentRef === booking!.paymentRef,
    );
    expect(paid?.status).toBe('paid');
    expect(paid).toHaveProperty('paidAt');
    expect(await slotStatus('08:00')).toBe('booked');
  });

  it('webhook capture+accept -> paid; capture+challenge tetap pending', async () => {
    const created = await request(app.getHttpServer())
      .post('/bookings')
      .set(authUser())
      .send({ courtId, date: DATE, start: '10:00' })
      .expect(201);

    const challenge = await request(app.getHttpServer())
      .post('/payments/midtrans/notification')
      .send(notif(created.body, 'capture', { fraud_status: 'challenge' }))
      .expect(200);
    expect(challenge.body.status).toBe('pending');

    const accept = await request(app.getHttpServer())
      .post('/payments/midtrans/notification')
      .send(notif(created.body, 'capture', { fraud_status: 'accept' }))
      .expect(200);
    expect(accept.body.status).toBe('paid');
  });

  it('webhook signature invalid -> 403 dan status tidak berubah', async () => {
    const mine = await request(app.getHttpServer())
      .get('/bookings/me')
      .set(authOther())
      .expect(200);
    const booking = (
      mine.body.data as Array<{ paymentRef: string; amount: number; start: string }>
    ).find((b) => b.start === '09:00');
    expect(booking).toBeDefined();

    const bad = notif(booking!, 'settlement');
    bad.signature_key = '0'.repeat(128);
    await request(app.getHttpServer())
      .post('/payments/midtrans/notification')
      .send(bad)
      .expect(403);

    const after = await request(app.getHttpServer())
      .get('/bookings/me')
      .set(authOther())
      .expect(200);
    const still = (after.body.data as Array<{ paymentRef: string; status: string }>).find(
      (b) => b.paymentRef === booking!.paymentRef,
    );
    expect(still?.status).toBe('pending');
  });

  it('webhook expire -> expired + slot free lagi', async () => {
    const mine = await request(app.getHttpServer())
      .get('/bookings/me')
      .set(authOther())
      .expect(200);
    const booking = (
      mine.body.data as Array<{ paymentRef: string; amount: number; start: string }>
    ).find((b) => b.start === '09:00');

    const res = await request(app.getHttpServer())
      .post('/payments/midtrans/notification')
      .send(notif(booking!, 'expire'))
      .expect(200);
    expect(res.body.status).toBe('expired');
    expect(await slotStatus('09:00')).toBe('free');
  });

  it('webhook deny/cancel -> cancelled + slot free', async () => {
    const created = await request(app.getHttpServer())
      .post('/bookings')
      .set(authOther())
      .send({ courtId, date: DATE, start: '09:00' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/payments/midtrans/notification')
      .send(notif(created.body, 'deny'))
      .expect(200);
    expect(res.body.status).toBe('cancelled');
    expect(await slotStatus('09:00')).toBe('free');
  });

  it('webhook settlement dengan gross_amount salah -> 409 dan tetap pending', async () => {
    const created = await request(app.getHttpServer())
      .post('/bookings')
      .set(authOther())
      .send({ courtId, date: DATE, start: '09:00' })
      .expect(201);
    expect(created.body.status).toBe('pending');

    const statusCode = '200';
    const wrongAmount = String(created.body.amount + 1000);
    await request(app.getHttpServer())
      .post('/payments/midtrans/notification')
      .send({
        order_id: created.body.paymentRef,
        status_code: statusCode,
        gross_amount: wrongAmount,
        signature_key: sign(created.body.paymentRef, statusCode, wrongAmount),
        transaction_status: 'settlement',
      })
      .expect(409);

    const me = await request(app.getHttpServer())
      .get('/bookings/me')
      .set(authOther())
      .expect(200);
    const still = (
      me.body.data as Array<{ paymentRef: string; status: string }>
    ).find((b) => b.paymentRef === created.body.paymentRef);
    expect(still?.status).toBe('pending');

    // Bersih-bersih: expire agar slot 09:00 bebas untuk test berikut.
    await request(app.getHttpServer())
      .post('/payments/midtrans/notification')
      .send(notif(created.body, 'expire'))
      .expect(200);
    expect(await slotStatus('09:00')).toBe('free');
  });

  it('cancel milik sendiri (pending) -> cancelled + slot free; cancel ulang -> 409', async () => {
    const created = await request(app.getHttpServer())
      .post('/bookings')
      .set(authOther())
      .send({ courtId, date: DATE, start: '09:00' })
      .expect(201);

    const cancelled = await request(app.getHttpServer())
      .post(`/bookings/${created.body.id}/cancel`)
      .set(authOther())
      .expect(200);
    expect(cancelled.body.status).toBe('cancelled');
    expect(await slotStatus('09:00')).toBe('free');

    await request(app.getHttpServer())
      .post(`/bookings/${created.body.id}/cancel`)
      .set(authOther())
      .expect(409);
  });

  it('cancel milik orang lain -> 403; cancel booking paid -> 409', async () => {
    const mine = await request(app.getHttpServer())
      .get('/bookings/me')
      .set(authUser())
      .expect(200);
    const paid = (
      mine.body.data as Array<{ id: string; status: string }>
    ).find((b) => b.status === 'paid');
    expect(paid).toBeDefined();

    await request(app.getHttpServer())
      .post(`/bookings/${paid!.id}/cancel`)
      .set(authOther())
      .expect(403);

    await request(app.getHttpServer())
      .post(`/bookings/${paid!.id}/cancel`)
      .set(authUser())
      .expect(409);

    await request(app.getHttpServer())
      .get(`/bookings/${paid!.id}`)
      .set(authOther())
      .expect(403);
  });

  it('pending > 30 mnt -> expired + slot bebas (via cek saat baca)', async () => {
    const created = await request(app.getHttpServer())
      .post('/bookings')
      .set(authOther())
      .send({ courtId, date: DATE, start: '09:00' })
      .expect(201);
    expect(await slotStatus('09:00')).toBe('booked');

    await bookings.update(
      { id: created.body.id },
      { createdAt: new Date(Date.now() - 31 * 60 * 1000) },
    );

    const me = await request(app.getHttpServer())
      .get('/bookings/me')
      .set(authOther())
      .expect(200);
    const expired = (me.body.data as Array<{ id: string; status: string }>).find(
      (b) => b.id === created.body.id,
    );
    expect(expired?.status).toBe('expired');
    expect(await slotStatus('09:00')).toBe('free');
  });

  it('booking di luar open_hours -> 400', async () => {
    await request(app.getHttpServer())
      .post('/bookings')
      .set(authUser())
      .send({ courtId, date: DATE, start: '11:00' })
      .expect(400);
  });

  afterAll(async () => {
    await app.close();
  });
});
