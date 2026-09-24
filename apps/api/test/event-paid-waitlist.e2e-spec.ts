process.env.DB_DRIVER = 'sqljs';
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '7d';
// Paksa mode stub Midtrans (tanpa network/key): signature dihitung dengan key kosong.
process.env.MIDTRANS_SERVER_KEY = '';

import { createHash } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

function sign(orderId: string, statusCode: string, grossAmount: string): string {
  return createHash('sha512')
    .update(`${orderId}${statusCode}${grossAmount}`)
    .digest('hex');
}

function notif(paymentRef: string, amount: number, transactionStatus: string) {
  const statusCode = '200';
  const grossAmount = String(amount);
  return {
    order_id: paymentRef,
    status_code: statusCode,
    gross_amount: grossAmount,
    signature_key: sign(paymentRef, statusCode, grossAmount),
    transaction_status: transactionStatus,
  };
}

describe('Events ST-02 paid + ST-03 waitlist (e2e)', () => {
  let app: INestApplication;
  const ts = Date.now();
  const password = 'Password123!';
  let hostToken: string;

  const basePayload = {
    sport: 'Futsal',
    title: 'ST-02 Paid Event',
    description: 'Uji event berbayar + waitlist',
    datetime: '2026-11-04T09:00:00+07:00',
    lat: -6.2,
    lng: 106.8,
    capacity: 5,
  };

  async function register(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, displayName: email.split('@')[0] })
      .expect(201);
    return res.body.accessToken as string;
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

    hostToken = await register(`st02host_${ts}@example.com`);
  });

  it('create: fee default 0 (gratis), fee tersimpan bila diisi, PATCH fee bisa diubah host', async () => {
    const free = await request(app.getHttpServer())
      .post('/events')
      .set({ Authorization: `Bearer ${hostToken}` })
      .send({ ...basePayload, title: 'ST-02 Free Default' })
      .expect(201);
    expect(free.body.fee).toBe(0);

    const paid = await request(app.getHttpServer())
      .post('/events')
      .set({ Authorization: `Bearer ${hostToken}` })
      .send({ ...basePayload, title: 'ST-02 Fee Check', fee: 50000 })
      .expect(201);
    expect(paid.body.fee).toBe(50000);

    const updated = await request(app.getHttpServer())
      .patch(`/events/${paid.body.id}`)
      .set({ Authorization: `Bearer ${hostToken}` })
      .send({ fee: 75000 })
      .expect(200);
    expect(updated.body.fee).toBe(75000);

    await request(app.getHttpServer())
      .post('/events')
      .set({ Authorization: `Bearer ${hostToken}` })
      .send({ ...basePayload, title: 'ST-02 Fee Invalid', fee: -100 })
      .expect(400);
  });

  it('event gratis: join langsung jadi peserta (isJoined true)', async () => {
    const ev = await request(app.getHttpServer())
      .post('/events')
      .set({ Authorization: `Bearer ${hostToken}` })
      .send({ ...basePayload, title: 'ST-02 Free Join' })
      .expect(201);
    const token = await register(`st02free_${ts}@example.com`);
    const joined = await request(app.getHttpServer())
      .post(`/events/${ev.body.id}/join`)
      .set({ Authorization: `Bearer ${token}` })
      .expect(201);
    expect(joined.body.isJoined).toBe(true);
    expect(joined.body.payment).toBeUndefined();
  });

  describe('event berbayar (ST-02)', () => {
    let eventId: string;
    let tokenA: string;
    let tokenB: string;
    const FEE = 25000;
    let paymentRefA: string;

    beforeAll(async () => {
      const ev = await request(app.getHttpServer())
        .post('/events')
        .set({ Authorization: `Bearer ${hostToken}` })
        .send({ ...basePayload, title: 'ST-02 Paid Flow', fee: FEE })
        .expect(201);
      eventId = ev.body.id as string;
      tokenA = await register(`st02a_${ts}@example.com`);
      tokenB = await register(`st02b_${ts}@example.com`);
    });

    it('join -> 201 pending-payment + snap, BELUM jadi peserta', async () => {
      const res = await request(app.getHttpServer())
        .post(`/events/${eventId}/join`)
        .set({ Authorization: `Bearer ${tokenA}` })
        .expect(201);
      expect(res.body.isJoined).toBe(false);
      expect(res.body.payment).toBeDefined();
      expect(res.body.payment.status).toBe('pending');
      expect(res.body.payment.amount).toBe(FEE);
      expect(res.body.payment.paymentRef).toMatch(/^EV-/);
      expect(res.body.payment.snapToken).toMatch(/^stub-snap-EV-/);
      paymentRefA = res.body.payment.paymentRef as string;

      // Belum peserta: detail + participants tidak berubah (count tetap 1 = host).
      const detail = await request(app.getHttpServer())
        .get(`/events/${eventId}`)
        .set({ Authorization: `Bearer ${tokenA}` })
        .expect(200);
      expect(detail.body.isJoined).toBe(false);
      expect(detail.body.participantsCount).toBe(1);

      const parts = await request(app.getHttpServer())
        .get(`/events/${eventId}/participants`)
        .set({ Authorization: `Bearer ${tokenA}` })
        .expect(200);
      expect(parts.body.meta.total).toBe(1);
    });

    it('join ulang saat pending -> 201 idempotent (paymentRef sama, tanpa Snap baru)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/events/${eventId}/join`)
        .set({ Authorization: `Bearer ${tokenA}` })
        .expect(201);
      expect(res.body.isJoined).toBe(false);
      expect(res.body.payment.paymentRef).toBe(paymentRefA);
    });

    it('pending TIDAK makan slot: user lain tetap bisa minta payment', async () => {
      const res = await request(app.getHttpServer())
        .post(`/events/${eventId}/join`)
        .set({ Authorization: `Bearer ${tokenB}` })
        .expect(201);
      expect(res.body.isJoined).toBe(false);
      expect(res.body.payment.status).toBe('pending');
      expect(res.body.payment.paymentRef).not.toBe(paymentRefA);
    });

    it('webhook amount salah -> 409, tetap bukan peserta + tetap pending', async () => {
      await request(app.getHttpServer())
        .post('/payments/midtrans/notification')
        .send(notif(paymentRefA, FEE - 1, 'settlement'))
        .expect(409);

      const detail = await request(app.getHttpServer())
        .get(`/events/${eventId}`)
        .set({ Authorization: `Bearer ${tokenA}` })
        .expect(200);
      expect(detail.body.isJoined).toBe(false);
      expect(detail.body.participantsCount).toBe(1);

      // Masih pending: join ulang mengembalikan paymentRef yang sama.
      const retry = await request(app.getHttpServer())
        .post(`/events/${eventId}/join`)
        .set({ Authorization: `Bearer ${tokenA}` })
        .expect(201);
      expect(retry.body.payment.paymentRef).toBe(paymentRefA);
      expect(retry.body.payment.status).toBe('pending');
    });

    it('webhook settlement -> paid + jadi peserta; double-hit idempotent', async () => {
      await request(app.getHttpServer())
        .post('/payments/midtrans/notification')
        .send(notif(paymentRefA, FEE, 'settlement'))
        .expect(200);

      const detail = await request(app.getHttpServer())
        .get(`/events/${eventId}`)
        .set({ Authorization: `Bearer ${tokenA}` })
        .expect(200);
      expect(detail.body.isJoined).toBe(true);
      expect(detail.body.participantsCount).toBe(2);

      const parts = await request(app.getHttpServer())
        .get(`/events/${eventId}/participants`)
        .set({ Authorization: `Bearer ${tokenA}` })
        .expect(200);
      expect(parts.body.meta.total).toBe(2);

      // Double-hit webhook aman (tetap paid, tanpa duplikat peserta).
      const again = await request(app.getHttpServer())
        .post('/payments/midtrans/notification')
        .send(notif(paymentRefA, FEE, 'settlement'))
        .expect(200);
      expect(again.body.status).toBe('paid');
      const parts2 = await request(app.getHttpServer())
        .get(`/events/${eventId}/participants`)
        .set({ Authorization: `Bearer ${tokenA}` })
        .expect(200);
      expect(parts2.body.meta.total).toBe(2);

      // Sudah peserta -> join lagi 409.
      await request(app.getHttpServer())
        .post(`/events/${eventId}/join`)
        .set({ Authorization: `Bearer ${tokenA}` })
        .expect(409);
    });

    it('event berbayar yang paid-penuh -> join 409 waitlisted (tanpa payment baru)', async () => {
      const small = await request(app.getHttpServer())
        .post('/events')
        .set({ Authorization: `Bearer ${hostToken}` })
        .send({ ...basePayload, title: 'ST-02 Paid Full', capacity: 2, fee: 10000 })
        .expect(201);
      const smallId = small.body.id as string;

      const t1 = await register(`st02full1_${ts}@example.com`);
      const j1 = await request(app.getHttpServer())
        .post(`/events/${smallId}/join`)
        .set({ Authorization: `Bearer ${t1}` })
        .expect(201);
      await request(app.getHttpServer())
        .post('/payments/midtrans/notification')
        .send(notif(j1.body.payment.paymentRef, 10000, 'settlement'))
        .expect(200);

      const full = await request(app.getHttpServer())
        .get(`/events/${smallId}`)
        .set({ Authorization: `Bearer ${hostToken}` })
        .expect(200);
      expect(full.body.participantsCount).toBe(2);
      expect(full.body.status).toBe('full');

      const t2 = await register(`st02full2_${ts}@example.com`);
      const denied = await request(app.getHttpServer())
        .post(`/events/${smallId}/join`)
        .set({ Authorization: `Bearer ${t2}` })
        .expect(409);
      expect(denied.body.waitlisted).toBe(true);
      expect(denied.body.position).toBe(1);
      expect(denied.body.payment).toBeUndefined();
    });
  });

  describe('waiting list (ST-03)', () => {
    let eventId: string;
    let tokenA: string;
    let tokenB: string;
    let tokenC: string;

    beforeAll(async () => {
      const ev = await request(app.getHttpServer())
        .post('/events')
        .set({ Authorization: `Bearer ${hostToken}` })
        .send({ ...basePayload, title: 'ST-03 Waitlist', capacity: 2 })
        .expect(201);
      eventId = ev.body.id as string;
      tokenA = await register(`st03a_${ts}@example.com`);
      tokenB = await register(`st03b_${ts}@example.com`);
      tokenC = await register(`st03c_${ts}@example.com`);
      // Penuhi event: host + A.
      await request(app.getHttpServer())
        .post(`/events/${eventId}/join`)
        .set({ Authorization: `Bearer ${tokenA}` })
        .expect(201);
    });

    it('full -> join 409 { waitlisted:true, position } berurutan', async () => {
      const b = await request(app.getHttpServer())
        .post(`/events/${eventId}/join`)
        .set({ Authorization: `Bearer ${tokenB}` })
        .expect(409);
      expect(b.body.waitlisted).toBe(true);
      expect(b.body.position).toBe(1);

      const c = await request(app.getHttpServer())
        .post(`/events/${eventId}/join`)
        .set({ Authorization: `Bearer ${tokenC}` })
        .expect(409);
      expect(c.body.waitlisted).toBe(true);
      expect(c.body.position).toBe(2);
    });

    it('duplikat antrean -> 409', async () => {
      const dup = await request(app.getHttpServer())
        .post(`/events/${eventId}/join`)
        .set({ Authorization: `Bearer ${tokenB}` })
        .expect(409);
      expect(dup.body.waitlisted).toBeUndefined();
    });

    it('GET waitlist/me -> posisiku; bukan antrean -> 404', async () => {
      const me = await request(app.getHttpServer())
        .get(`/events/${eventId}/waitlist/me`)
        .set({ Authorization: `Bearer ${tokenB}` })
        .expect(200);
      expect(me.body.position).toBe(1);
      expect(me.body.status).toBe('waiting');

      await request(app.getHttpServer())
        .get(`/events/${eventId}/waitlist/me`)
        .set({ Authorization: `Bearer ${tokenA}` })
        .expect(404);
    });

    it('GET waitlist host -> daftar urut posisi; non-host -> 403', async () => {
      const list = await request(app.getHttpServer())
        .get(`/events/${eventId}/waitlist`)
        .set({ Authorization: `Bearer ${hostToken}` })
        .expect(200);
      expect(list.body.meta.total).toBe(2);
      expect(list.body.data.map((w: { position: number }) => w.position)).toEqual([1, 2]);

      await request(app.getHttpServer())
        .get(`/events/${eventId}/waitlist`)
        .set({ Authorization: `Bearer ${tokenB}` })
        .expect(403);
    });

    it('DELETE waitlist/me -> keluar antrean; lalu kosong -> 404', async () => {
      await request(app.getHttpServer())
        .delete(`/events/${eventId}/waitlist/me`)
        .set({ Authorization: `Bearer ${tokenC}` })
        .expect(200);
      await request(app.getHttpServer())
        .get(`/events/${eventId}/waitlist/me`)
        .set({ Authorization: `Bearer ${tokenC}` })
        .expect(404);
      await request(app.getHttpServer())
        .delete(`/events/${eventId}/waitlist/me`)
        .set({ Authorization: `Bearer ${tokenC}` })
        .expect(404);
    });

    it('promosi saat leave: antrean #1 jadi invited, #2 tetap waiting', async () => {
      // C masuk antrean lagi (posisi = count+1 = 2, tanpa reorder).
      const c = await request(app.getHttpServer())
        .post(`/events/${eventId}/join`)
        .set({ Authorization: `Bearer ${tokenC}` })
        .expect(409);
      expect(c.body.waitlisted).toBe(true);
      expect(c.body.position).toBe(2);

      // A leave -> slot kosong -> B (terdepan) dipromosi invited.
      await request(app.getHttpServer())
        .post(`/events/${eventId}/leave`)
        .set({ Authorization: `Bearer ${tokenA}` })
        .expect(200);

      const list = await request(app.getHttpServer())
        .get(`/events/${eventId}/waitlist`)
        .set({ Authorization: `Bearer ${hostToken}` })
        .expect(200);
      expect(list.body.meta.total).toBe(2);
      const byUser = Object.fromEntries(
        (list.body.data as Array<{ userId: string; status: string }>).map((w) => [
          w.userId,
          w.status,
        ]),
      );
      const users = await Promise.all(
        [tokenB, tokenC].map(async (t) => {
          const me = await request(app.getHttpServer())
            .get('/me')
            .set({ Authorization: `Bearer ${t}` })
            .expect(200);
          return me.body.id as string;
        }),
      );
      expect(byUser[users[0]]).toBe('invited');
      expect(byUser[users[1]]).toBe('waiting');

      const meB = await request(app.getHttpServer())
        .get(`/events/${eventId}/waitlist/me`)
        .set({ Authorization: `Bearer ${tokenB}` })
        .expect(200);
      expect(meB.body.status).toBe('invited');
    });

    it('waitlist tanpa token -> 401; event tak ada -> 404', async () => {
      const missing = '00000000-0000-4000-8000-000000000000';
      await request(app.getHttpServer()).get(`/events/${eventId}/waitlist/me`).expect(401);
      await request(app.getHttpServer()).delete(`/events/${eventId}/waitlist/me`).expect(401);
      await request(app.getHttpServer())
        .get(`/events/${missing}/waitlist/me`)
        .set({ Authorization: `Bearer ${hostToken}` })
        .expect(404);
      await request(app.getHttpServer())
        .get(`/events/${missing}/waitlist`)
        .set({ Authorization: `Bearer ${hostToken}` })
        .expect(404);
    });
  });

  afterAll(async () => {
    await app.close();
  });
});
