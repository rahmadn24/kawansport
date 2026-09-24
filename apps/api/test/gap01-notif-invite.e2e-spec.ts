process.env.DB_DRIVER = 'sqljs';
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '7d';
process.env.FIREBASE_STUB = 'true';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { User } from '../src/users/user.entity';

describe('GAP-01 (e2e): notifications history + invites', () => {
  let app: INestApplication;
  let users: Repository<User>;
  const ts = Date.now();
  const password = 'Password123!';

  let tokenA: string;
  let tokenB: string;
  let tokenC: string;
  let idA: string;
  let idB: string;
  let adminToken: string;
  let adminId: string;

  const authA = () => ({ Authorization: `Bearer ${tokenA}` });
  const authB = () => ({ Authorization: `Bearer ${tokenB}` });
  const authC = () => ({ Authorization: `Bearer ${tokenC}` });

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
      .send({ email: `gap01a_${ts}@example.com`, password })
      .expect(201);
    tokenA = ra.body.accessToken;
    idA = ra.body.user.id;

    const rb = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `gap01b_${ts}@example.com`, password })
      .expect(201);
    tokenB = rb.body.accessToken;
    idB = rb.body.user.id;

    const rc = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `gap01c_${ts}@example.com`, password })
      .expect(201);
    tokenC = rc.body.accessToken;

    const rad = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `gap01admin_${ts}@example.com`, password })
      .expect(201);
    adminId = rad.body.user.id;
    await users.update({ id: adminId }, { role: 'super_admin' });
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: `gap01admin_${ts}@example.com`, password })
      .expect(200);
    adminToken = login.body.accessToken;

    // Device untuk B agar send benar-benar terkirim.
    await request(app.getHttpServer())
      .post('/notifications/register')
      .set(authB())
      .send({ token: `fcm-gap01-${ts}`, platform: 'android' })
      .expect(200);
  });

  it('riwayat muncul setelah send + page/limit', async () => {
    const before = await request(app.getHttpServer())
      .get('/notifications/me')
      .set(authB())
      .expect(200);
    const totalBefore = before.body.meta.total as number;

    await request(app.getHttpServer())
      .post('/notifications/send')
      .set({ Authorization: `Bearer ${adminToken}` })
      .send({ userIds: [idB], title: 'Halo B', body: 'Riwayat test', data: { type: 'system' } })
      .expect(200);

    const after = await request(app.getHttpServer())
      .get('/notifications/me')
      .query({ page: 1, limit: 20 })
      .set(authB())
      .expect(200);
    expect(after.body.meta.total).toBe(totalBefore + 1);
    expect(after.body.meta).toMatchObject({ page: 1, limit: 20 });
    const row = (after.body.data as Array<{ title: string; body: string; type: string }>)[0];
    expect(row).toMatchObject({ title: 'Halo B', body: 'Riwayat test', type: 'system' });
  });

  it('GET /notifications/me tanpa token -> 401', async () => {
    await request(app.getHttpServer()).get('/notifications/me').expect(401);
  });

  it('read milik sendiri + idempotent + lintas user 404', async () => {
    const list = await request(app.getHttpServer())
      .get('/notifications/me')
      .set(authB())
      .expect(200);
    const notifId = list.body.data[0].id as string;
    expect(list.body.data[0].readAt).toBeNull();

    const r1 = await request(app.getHttpServer())
      .post(`/notifications/${notifId}/read`)
      .set(authB())
      .expect(200);
    expect(r1.body.readAt).not.toBeNull();

    // Idempotent: baca lagi tetap 200.
    await request(app.getHttpServer())
      .post(`/notifications/${notifId}/read`)
      .set(authB())
      .expect(200);

    // Lintas user (A) -> 404.
    await request(app.getHttpServer())
      .post(`/notifications/${notifId}/read`)
      .set(authA())
      .expect(404);

    await request(app.getHttpServer())
      .post(`/notifications/${notifId}/read`)
      .expect(401);
  });

  it('invite create + validasi + duplikat', async () => {
    // Diri sendiri -> 400.
    await request(app.getHttpServer())
      .post('/invites')
      .set(authA())
      .send({ toUserId: idA })
      .expect(400);

    // Target tak ada -> 404.
    await request(app.getHttpServer())
      .post('/invites')
      .set(authA())
      .send({ toUserId: '00000000-0000-4000-8000-000000000000' })
      .expect(404);

    // Message >500 -> 400.
    await request(app.getHttpServer())
      .post('/invites')
      .set(authA())
      .send({ toUserId: idB, message: 'x'.repeat(501) })
      .expect(400);

    // Tanpa token -> 401.
    await request(app.getHttpServer())
      .post('/invites')
      .send({ toUserId: idB })
      .expect(401);

    // Valid.
    const created = await request(app.getHttpServer())
      .post('/invites')
      .set(authA())
      .send({ toUserId: idB, sport: 'Futsal', message: 'Sparing yuk!' })
      .expect(201);
    expect(created.body).toMatchObject({
      fromUserId: idA,
      toUserId: idB,
      sport: 'Futsal',
      message: 'Sparing yuk!',
      status: 'pending',
    });

    // Duplikat pending sama -> 409.
    await request(app.getHttpServer())
      .post('/invites')
      .set(authA())
      .send({ toUserId: idB })
      .expect(409);
  });

  it('invite list masuk vs sent', async () => {
    const inboxB = await request(app.getHttpServer())
      .get('/invites/me')
      .set(authB())
      .expect(200);
    expect(
      (inboxB.body.data as Array<{ toUserId: string }>).some((i) => i.toUserId === idB),
    ).toBe(true);

    const sentA = await request(app.getHttpServer())
      .get('/invites/me')
      .query({ dir: 'sent' })
      .set(authA())
      .expect(200);
    expect(
      (sentA.body.data as Array<{ fromUserId: string }>).some((i) => i.fromUserId === idA),
    ).toBe(true);

    // A tidak punya inbox dari kasus ini.
    const inboxA = await request(app.getHttpServer())
      .get('/invites/me')
      .set(authA())
      .expect(200);
    expect(
      (inboxA.body.data as Array<{ fromUserId: string }>).filter(
        (i) => i.fromUserId === idA,
      ),
    ).toHaveLength(0);
  });

  it('accept oleh bukan-penerima 403 + accept ganda 409 + conversation terbentuk', async () => {
    const inboxB = await request(app.getHttpServer())
      .get('/invites/me')
      .set(authB())
      .expect(200);
    const inviteId = inboxB.body.data[0].id as string;

    // Bukan penerima (C, pengirim A) -> 403.
    await request(app.getHttpServer())
      .post(`/invites/${inviteId}/accept`)
      .set(authC())
      .expect(403);
    await request(app.getHttpServer())
      .post(`/invites/${inviteId}/accept`)
      .set(authA())
      .expect(403);

    // Penerima accept -> 200 + conversation keduanya.
    const acc = await request(app.getHttpServer())
      .post(`/invites/${inviteId}/accept`)
      .set(authB())
      .expect(200);
    expect(acc.body.status).toBe('accepted');
    expect(acc.body.conversation?.id).toBeDefined();
    const convId = acc.body.conversation.id as string;

    // Conversation terlihat di kedua sisi.
    const listA = await request(app.getHttpServer()).get('/conversations').set(authA()).expect(200);
    expect((listA.body.data as Array<{ id: string }>).some((c) => c.id === convId)).toBe(true);
    const listB = await request(app.getHttpServer()).get('/conversations').set(authB()).expect(200);
    expect((listB.body.data as Array<{ id: string }>).some((c) => c.id === convId)).toBe(true);

    // Accept ganda -> 409.
    await request(app.getHttpServer())
      .post(`/invites/${inviteId}/accept`)
      .set(authB())
      .expect(409);
  });

  it('decline + tolak ganda 409', async () => {
    const created = await request(app.getHttpServer())
      .post('/invites')
      .set(authC())
      .send({ toUserId: idB, message: 'Ikut main?' })
      .expect(201);
    const inviteId = created.body.id as string;

    // Bukan penerima -> 403.
    await request(app.getHttpServer())
      .post(`/invites/${inviteId}/decline`)
      .set(authA())
      .expect(403);

    const dec = await request(app.getHttpServer())
      .post(`/invites/${inviteId}/decline`)
      .set(authB())
      .expect(200);
    expect(dec.body.status).toBe('declined');

    await request(app.getHttpServer())
      .post(`/invites/${inviteId}/decline`)
      .set(authB())
      .expect(409);
  });

  afterAll(async () => {
    await app.close();
  });
});
