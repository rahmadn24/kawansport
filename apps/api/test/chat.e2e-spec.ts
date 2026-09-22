process.env.DB_DRIVER = 'sqljs';
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '7d';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { io as ioClient, type Socket } from 'socket.io-client';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Chat 1-1 (e2e) SM-07 — REST + WebSocket + unread', () => {
  let app: INestApplication;
  let port: number;
  const ts = Date.now();
  const userA = { email: `sm07a_${ts}@example.com`, password: 'Password123!' };
  const userB = { email: `sm07b_${ts}@example.com`, password: 'Password123!' };
  let tokenA: string;
  let tokenB: string;
  let idA: string;
  let idB: string;
  let convId: string;

  const connectWs = (token?: string): Promise<Socket> =>
    new Promise((resolve, reject) => {
      const s = ioClient(`http://127.0.0.1:${port}`, {
        auth: token ? { token } : {},
        transports: ['websocket'],
        timeout: 5000,
      });
      s.once('connect', () => resolve(s));
      s.once('connect_error', (e: Error) => reject(e));
      setTimeout(() => reject(new Error('WS connect timeout')), 8000);
    });

  const waitFor = <T>(s: Socket, event: string, timeoutMs = 8000): Promise<T> =>
    new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`timeout waiting ${event}`)), timeoutMs);
      s.once(event, (data: T) => {
        clearTimeout(t);
        resolve(data);
      });
    });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    await app.listen(0);
    port = app.getHttpServer().address().port;

    const ra = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ ...userA, displayName: 'SM07 A' })
      .expect(201);
    tokenA = ra.body.accessToken;
    idA = ra.body.user.id;

    const rb = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ ...userB, displayName: 'SM07 B' })
      .expect(201);
    tokenB = rb.body.accessToken;
    idB = rb.body.user.id;
  });

  const authA = () => ({ Authorization: `Bearer ${tokenA}` });
  const authB = () => ({ Authorization: `Bearer ${tokenB}` });

  it('GET /conversations tanpa token -> 401', async () => {
    await request(app.getHttpServer()).get('/conversations').expect(401);
  });

  it('POST /conversations chat dengan diri sendiri -> 400', async () => {
    await request(app.getHttpServer())
      .post('/conversations')
      .set(authA())
      .send({ partnerId: idA })
      .expect(400);
  });

  it('POST /conversations partner tidak ada -> 404', async () => {
    await request(app.getHttpServer())
      .post('/conversations')
      .set(authA())
      .send({ partnerId: '00000000-0000-4000-8000-000000000000' })
      .expect(404);
  });

  it('POST /conversations -> 201 get-or-create (A->B dan B->A id sama)', async () => {
    const r1 = await request(app.getHttpServer())
      .post('/conversations')
      .set(authA())
      .send({ partnerId: idB })
      .expect(201);
    expect(r1.body.id).toBeDefined();
    expect(r1.body.partner.id).toBe(idB);
    expect(r1.body.unreadCount).toBe(0);
    convId = r1.body.id;

    const r2 = await request(app.getHttpServer())
      .post('/conversations')
      .set(authB())
      .send({ partnerId: idA })
      .expect(201);
    expect(r2.body.id).toBe(convId);
  });

  it('WS tanpa token ditolak (disconnect)', async () => {
    const s = ioClient(`http://127.0.0.1:${port}`, {
      transports: ['websocket'],
      timeout: 3000,
      reconnection: false,
    });
    const done = await new Promise<boolean>((resolve) => {
      const t = setTimeout(() => resolve(false), 4000);
      s.once('disconnect', () => {
        clearTimeout(t);
        resolve(true);
      });
      s.once('connect_error', () => {
        clearTimeout(t);
        resolve(true);
      });
    });
    s.close();
    expect(done).toBe(true);
  });

  it('2 user chat realtime: join + message:send -> message:new + unread benar', async () => {
    const sockA = await connectWs(tokenA);
    const sockB = await connectWs(tokenB);
    try {
      const jA = await new Promise<unknown>((resolve) =>
        sockA.emit('join', { conversationId: convId }, resolve),
      );
      expect(jA).toMatchObject({ ok: true });
      const jB = await new Promise<unknown>((resolve) =>
        sockB.emit('join', { conversationId: convId }, resolve),
      );
      expect(jB).toMatchObject({ ok: true });

      // B dengarkan message:new + conversation:update sebelum A mengirim.
      const newOnB = waitFor<{ body: string; senderId: string }>(sockB, 'message:new');
      const updOnB = waitFor<{ conversationId: string; unreadCount: number }>(
        sockB,
        'conversation:update',
      );
      const ack: unknown = await new Promise((resolve) =>
        sockA.emit('message:send', { conversationId: convId, body: 'Halo B!' }, resolve),
      );
      expect(ack).toMatchObject({ ok: true });

      const got = await newOnB;
      expect(got.body).toBe('Halo B!');
      expect(got.senderId).toBe(idA);
      const upd = await updOnB;
      expect(upd.conversationId).toBe(convId);
      expect(upd.unreadCount).toBe(1);

      // History persist (ASC) + list unread B=1, A=0.
      const hist = await request(app.getHttpServer())
        .get(`/conversations/${convId}/messages`)
        .query({ page: 1, limit: 20 })
        .set(authB())
        .expect(200);
      expect(hist.body.meta.total).toBe(1);
      expect(hist.body.data[0]).toMatchObject({ body: 'Halo B!', senderId: idA });

      const listB = await request(app.getHttpServer())
        .get('/conversations')
        .set(authB())
        .expect(200);
      const rowB = (listB.body.data as Array<{ id: string; unreadCount: number }>).find(
        (c) => c.id === convId,
      );
      expect(rowB?.unreadCount).toBe(1);

      // B mark read -> unread 0.
      await request(app.getHttpServer())
        .post(`/conversations/${convId}/read`)
        .set(authB())
        .expect(200);
      const listB2 = await request(app.getHttpServer())
        .get('/conversations')
        .set(authB())
        .expect(200);
      const rowB2 = (listB2.body.data as Array<{ id: string; unreadCount: number }>).find(
        (c) => c.id === convId,
      );
      expect(rowB2?.unreadCount).toBe(0);

      // Orang luar tidak boleh baca history conversation ini -> 403/404.
      const outsider = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: `sm07c_${ts}@example.com`, password: 'Password123!' })
        .expect(201);
      await request(app.getHttpServer())
        .get(`/conversations/${convId}/messages`)
        .set({ Authorization: `Bearer ${outsider.body.accessToken}` })
        .expect(403);
    } finally {
      sockA.close();
      sockB.close();
    }
  });

  it('GET /conversations/:id/messages paginasi ASC', async () => {
    const sockA = await connectWs(tokenA);
    try {
      await new Promise<unknown>((resolve) => sockA.emit('join', { conversationId: convId }, resolve));
      for (const text of ['m1', 'm2', 'm3']) {
        await new Promise((resolve) =>
          sockA.emit('message:send', { conversationId: convId, body: text }, resolve),
        );
      }
      const p1 = await request(app.getHttpServer())
        .get(`/conversations/${convId}/messages`)
        .query({ page: 1, limit: 2 })
        .set(authA())
        .expect(200);
      expect(p1.body.data.map((m: { body: string }) => m.body)).toEqual(['Halo B!', 'm1']);
      expect(p1.body.meta).toMatchObject({ page: 1, limit: 2, total: 4 });
      const p2 = await request(app.getHttpServer())
        .get(`/conversations/${convId}/messages`)
        .query({ page: 2, limit: 2 })
        .set(authA())
        .expect(200);
      expect(p2.body.data.map((m: { body: string }) => m.body)).toEqual(['m2', 'm3']);
    } finally {
      sockA.close();
    }
  });

  afterAll(async () => {
    await app.close();
  });
});
