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

describe('GAP-02 (e2e): POST /conversations/:id/messages + DELETE /me', () => {
  let app: INestApplication;
  let users: Repository<User>;
  const ts = Date.now();
  const password = 'Password123!';

  let tokenA: string;
  let tokenB: string;
  let idA: string;
  let idB: string;
  let outsiderToken: string;
  let convId: string;

  const DATE = '2030-06-18';
  const ALL_DAYS_OPEN = {
    mon: ['08:00-11:00'],
    tue: ['08:00-11:00'],
    wed: ['08:00-11:00'],
    thu: ['08:00-11:00'],
    fri: ['08:00-11:00'],
    sat: ['08:00-11:00'],
    sun: ['08:00-11:00'],
  };

  const authA = () => ({ Authorization: `Bearer ${tokenA}` });
  const authB = () => ({ Authorization: `Bearer ${tokenB}` });
  const authOut = () => ({ Authorization: `Bearer ${outsiderToken}` });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    users = app.get<Repository<User>>(getRepositoryToken(User));

    const ra = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `gap02a_${ts}@example.com`, password, displayName: 'GAP02 A' })
      .expect(201);
    tokenA = ra.body.accessToken;
    idA = ra.body.user.id;

    const rb = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `gap02b_${ts}@example.com`, password, displayName: 'GAP02 B' })
      .expect(201);
    tokenB = rb.body.accessToken;
    idB = rb.body.user.id;

    const rc = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `gap02c_${ts}@example.com`, password })
      .expect(201);
    outsiderToken = rc.body.accessToken;

    const conv = await request(app.getHttpServer())
      .post('/conversations')
      .set(authA())
      .send({ partnerId: idB })
      .expect(201);
    convId = conv.body.id;
  });

  it('REST send -> 201 MessageItem + muncul di history + unread B=1', async () => {
    const sent = await request(app.getHttpServer())
      .post(`/conversations/${convId}/messages`)
      .set(authA())
      .send({ body: 'Halo via REST!' })
      .expect(201);
    expect(sent.body).toMatchObject({
      conversationId: convId,
      senderId: idA,
      body: 'Halo via REST!',
    });
    expect(sent.body.id).toBeDefined();
    expect(sent.body.createdAt).toBeDefined();

    const hist = await request(app.getHttpServer())
      .get(`/conversations/${convId}/messages`)
      .set(authB())
      .expect(200);
    expect(hist.body.meta.total).toBe(1);
    expect(hist.body.data[0]).toMatchObject({ body: 'Halo via REST!', senderId: idA });

    const listB = await request(app.getHttpServer())
      .get('/conversations')
      .set(authB())
      .expect(200);
    const rowB = (listB.body.data as Array<{ id: string; unreadCount: number }>).find(
      (c) => c.id === convId,
    );
    expect(rowB?.unreadCount).toBe(1);
  });

  it('REST send lintas anggota -> 403; conversation tak ada -> 404; tanpa token -> 401', async () => {
    await request(app.getHttpServer())
      .post(`/conversations/${convId}/messages`)
      .set(authOut())
      .send({ body: 'nyusup' })
      .expect(403);

    await request(app.getHttpServer())
      .post('/conversations/00000000-0000-4000-8000-000000000000/messages')
      .set(authA())
      .send({ body: 'halo?' })
      .expect(404);

    await request(app.getHttpServer())
      .post(`/conversations/${convId}/messages`)
      .send({ body: 'tanpa token' })
      .expect(401);
  });

  it('REST send body kosong / terlalu panjang / hilang -> 400', async () => {
    await request(app.getHttpServer())
      .post(`/conversations/${convId}/messages`)
      .set(authA())
      .send({ body: '' })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/conversations/${convId}/messages`)
      .set(authA())
      .send({ body: '   ' })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/conversations/${convId}/messages`)
      .set(authA())
      .send({ body: 'x'.repeat(2001) })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/conversations/${convId}/messages`)
      .set(authA())
      .send({})
      .expect(400);
  });

  it('DELETE /me tanpa halangan -> 200 + login lagi 401', async () => {
    const reg = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `gap02del_${ts}@example.com`, password })
      .expect(201);
    const tokenD = reg.body.accessToken as string;

    await request(app.getHttpServer())
      .delete('/me')
      .set({ Authorization: `Bearer ${tokenD}` })
      .expect(200)
      .expect((res) => {
        if (res.body.ok !== true) throw new Error('expected { ok: true }');
      });

    // Akun sudah hilang: login ulang ditolak + refresh ikut mati.
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: `gap02del_${ts}@example.com`, password })
      .expect(401);
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: reg.body.refreshToken })
      .expect(401);
  });

  it('DELETE /me tanpa token -> 401', async () => {
    await request(app.getHttpServer()).delete('/me').expect(401);
  });

  it('DELETE /me dengan booking paid aktif -> 409 + akun tetap ada', async () => {
    // Owner + venue + court (pola bookings.e2e-spec).
    const regOwner = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `gap02_owner_${ts}@example.com`, password })
      .expect(201);
    await users.update({ id: regOwner.body.user.id }, { role: 'venue_owner' });
    const ownerToken = (
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: `gap02_owner_${ts}@example.com`, password })
        .expect(200)
    ).body.accessToken;

    const venue = await request(app.getHttpServer())
      .post('/venues')
      .set({ Authorization: `Bearer ${ownerToken}` })
      .send({
        name: 'GOR GAP02',
        address: 'Jl. Hapus Akun No. 2',
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
        name: 'Lapangan GAP02',
        pricePerHour: 100000,
        openHours: ALL_DAYS_OPEN,
      })
      .expect(201);

    const regVictim = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `gap02victim_${ts}@example.com`, password })
      .expect(201);
    const victimToken = regVictim.body.accessToken as string;
    const victimAuth = { Authorization: `Bearer ${victimToken}` };

    const booking = await request(app.getHttpServer())
      .post('/bookings')
      .set(victimAuth)
      .send({ courtId: court.body.id, date: DATE, start: '08:00' })
      .expect(201);

    // Bayar lunas via webhook stub.
    const statusCode = '200';
    const grossAmount = String(booking.body.amount);
    await request(app.getHttpServer())
      .post('/payments/midtrans/notification')
      .send({
        order_id: booking.body.paymentRef,
        status_code: statusCode,
        gross_amount: grossAmount,
        signature_key: sign(booking.body.paymentRef, statusCode, grossAmount),
        transaction_status: 'settlement',
      })
      .expect(200);

    const del = await request(app.getHttpServer())
      .delete('/me')
      .set(victimAuth)
      .expect(409);
    expect(String(del.body.message ?? '')).toMatch(/booking/i);

    // Akun TIDAK terhapus: masih bisa login + booking tetap paid.
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: `gap02victim_${ts}@example.com`, password })
      .expect(200);
    const me = await request(app.getHttpServer())
      .get('/bookings/me')
      .set(victimAuth)
      .expect(200);
    expect(
      (me.body.data as Array<{ paymentRef: string; status: string }>).find(
        (b) => b.paymentRef === booking.body.paymentRef,
      )?.status,
    ).toBe('paid');
  });

  it('DELETE /me sebagai host event mendatang -> 409', async () => {
    const reg = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `gap02host_${ts}@example.com`, password })
      .expect(201);
    const tokenH = reg.body.accessToken as string;
    const authH = { Authorization: `Bearer ${tokenH}` };

    await request(app.getHttpServer())
      .post('/events')
      .set(authH)
      .send({
        sport: 'Badminton',
        title: 'Sparing GAP02',
        datetime: new Date(Date.now() + 7 * 86400_000).toISOString(),
        lat: -6.2,
        lng: 106.8,
        capacity: 10,
      })
      .expect(201);

    const del = await request(app.getHttpServer())
      .delete('/me')
      .set(authH)
      .expect(409);
    expect(String(del.body.message ?? '')).toMatch(/event/i);
  });

  afterAll(async () => {
    await app.close();
  });
});
