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
import { User } from '../src/users/user.entity';

describe('Dispute center API-W02 (e2e)', () => {
  let app: INestApplication;
  let users: Repository<User>;
  const ts = Date.now();
  const password = 'Password123!';

  let userAToken: string;
  let userBToken: string;
  let adminToken: string;

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

    userAToken = (
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: `dsp_a_${ts}@example.com`, password })
        .expect(201)
    ).body.accessToken as string;

    userBToken = (
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: `dsp_b_${ts}@example.com`, password })
        .expect(201)
    ).body.accessToken as string;

    const regAdmin = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `dsp_admin_${ts}@example.com`, password })
      .expect(201);
    await users.update(
      { id: regAdmin.body.user.id },
      { role: 'super_admin' },
    );
    adminToken = await login(`dsp_admin_${ts}@example.com`);
  });

  afterAll(async () => {
    await app.close();
  });

  const authA = () => ({ Authorization: `Bearer ${userAToken}` });
  const authB = () => ({ Authorization: `Bearer ${userBToken}` });
  const authAdmin = () => ({ Authorization: `Bearer ${adminToken}` });

  it('POST /disputes tanpa token -> 401', async () => {
    await request(app.getHttpServer())
      .post('/disputes')
      .send({
        targetType: 'booking',
        targetId: 'some-id',
        category: 'no_show',
        description: 'Tidak datang',
      })
      .expect(401);
  });

  it('create 201 status open; validasi targetId/category/description', async () => {
    const res = await request(app.getHttpServer())
      .post('/disputes')
      .set(authA())
      .send({
        targetType: 'booking',
        targetId: 'booking-123',
        category: 'no_show',
        description: 'Lawan tidak datang',
      })
      .expect(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe('open');
    expect(res.body.reporterId).toBeTruthy();
    expect(res.body.resolution).toBeNull();

    // targetId kosong -> 400.
    await request(app.getHttpServer())
      .post('/disputes')
      .set(authA())
      .send({
        targetType: 'order',
        targetId: '   ',
        category: 'refund',
        description: 'x',
      })
      .expect(400);
    // category invalid -> 400; description >2000 -> 400.
    await request(app.getHttpServer())
      .post('/disputes')
      .set(authA())
      .send({
        targetType: 'order',
        targetId: 'o-1',
        category: 'ngambek',
        description: 'x',
      })
      .expect(400);
    await request(app.getHttpServer())
      .post('/disputes')
      .set(authA())
      .send({
        targetType: 'user',
        targetId: 'u-1',
        category: 'smurfing',
        description: 'x'.repeat(2001),
      })
      .expect(400);
  });

  it('GET /disputes/me hanya milik sendiri', async () => {
    const b = await request(app.getHttpServer())
      .post('/disputes')
      .set(authB())
      .send({
        targetType: 'venue',
        targetId: 'venue-9',
        category: 'other',
        description: 'Milik B',
      })
      .expect(201);

    const meA = await request(app.getHttpServer())
      .get('/disputes/me')
      .set(authA())
      .expect(200);
    const idsA = (meA.body.data as Array<{ id: string }>).map((d) => d.id);
    expect(idsA.length).toBeGreaterThan(0);
    expect(idsA).not.toContain(b.body.id);

    const meB = await request(app.getHttpServer())
      .get('/disputes/me')
      .set(authB())
      .expect(200);
    const idsB = (meB.body.data as Array<{ id: string }>).map((d) => d.id);
    expect(idsB).toContain(b.body.id);

    await request(app.getHttpServer()).get('/disputes/me').expect(401);
  });

  it('endpoint admin oleh user biasa -> 403', async () => {
    await request(app.getHttpServer())
      .get('/disputes')
      .set(authA())
      .expect(403);
    await request(app.getHttpServer())
      .post('/disputes/00000000-0000-0000-0000-000000000000/investigate')
      .set(authA())
      .expect(403);
    await request(app.getHttpServer())
      .post('/disputes/00000000-0000-0000-0000-000000000000/resolve')
      .set(authA())
      .send({ status: 'rejected' })
      .expect(403);
    // Tanpa token -> 401.
    await request(app.getHttpServer()).get('/disputes').expect(401);
  });

  it('admin list + filter status', async () => {
    const all = await request(app.getHttpServer())
      .get('/disputes')
      .set(authAdmin())
      .expect(200);
    expect(all.body.meta.total).toBeGreaterThanOrEqual(2);

    const open = await request(app.getHttpServer())
      .get('/disputes')
      .set(authAdmin())
      .query({ status: 'open' })
      .expect(200);
    expect(
      (open.body.data as Array<{ status: string }>).every(
        (d) => d.status === 'open',
      ),
    ).toBe(true);
  });

  it('transisi valid: investigate lalu resolve; resolve langsung dari open', async () => {
    const created = await request(app.getHttpServer())
      .post('/disputes')
      .set(authA())
      .send({
        targetType: 'order',
        targetId: 'order-1',
        category: 'refund',
        description: 'Minta refund',
      })
      .expect(201);

    const inv = await request(app.getHttpServer())
      .post(`/disputes/${created.body.id}/investigate`)
      .set(authAdmin())
      .expect(200);
    expect(inv.body.status).toBe('investigating');

    const resolved = await request(app.getHttpServer())
      .post(`/disputes/${created.body.id}/resolve`)
      .set(authAdmin())
      .send({ status: 'resolved', resolution: 'Refund disetujui' })
      .expect(200);
    expect(resolved.body.status).toBe('resolved');
    expect(resolved.body.resolution).toBe('Refund disetujui');
    expect(resolved.body.resolvedBy).toBeTruthy();

    // Resolve langsung dari open (tanpa investigate) -> 200 rejected.
    const direct = await request(app.getHttpServer())
      .post('/disputes')
      .set(authB())
      .send({
        targetType: 'user',
        targetId: 'user-x',
        category: 'smurfing',
        description: 'Skill tidak wajar',
      })
      .expect(201);
    const rejected = await request(app.getHttpServer())
      .post(`/disputes/${direct.body.id}/resolve`)
      .set(authAdmin())
      .send({ status: 'rejected' })
      .expect(200);
    expect(rejected.body.status).toBe('rejected');
  });

  it('transisi invalid -> 409; resolve resolved tanpa resolution -> 400', async () => {
    const created = await request(app.getHttpServer())
      .post('/disputes')
      .set(authA())
      .send({
        targetType: 'booking',
        targetId: 'booking-77',
        category: 'other',
        description: 'Kasus uji transisi',
      })
      .expect(201);
    const id = created.body.id as string;

    // resolved tanpa resolution -> 400.
    await request(app.getHttpServer())
      .post(`/disputes/${id}/resolve`)
      .set(authAdmin())
      .send({ status: 'resolved' })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/disputes/${id}/investigate`)
      .set(authAdmin())
      .expect(200);
    // investigate ulang atas investigating -> 409.
    await request(app.getHttpServer())
      .post(`/disputes/${id}/investigate`)
      .set(authAdmin())
      .expect(409);

    await request(app.getHttpServer())
      .post(`/disputes/${id}/resolve`)
      .set(authAdmin())
      .send({ status: 'rejected', resolution: 'Tidak terbukti' })
      .expect(200);
    // resolve/investigate atas terminal -> 409.
    await request(app.getHttpServer())
      .post(`/disputes/${id}/resolve`)
      .set(authAdmin())
      .send({ status: 'rejected' })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/disputes/${id}/investigate`)
      .set(authAdmin())
      .expect(409);

    // id tak ada -> 404.
    await request(app.getHttpServer())
      .post('/disputes/00000000-0000-0000-0000-000000000000/investigate')
      .set(authAdmin())
      .expect(404);
    await request(app.getHttpServer())
      .post('/disputes/00000000-0000-0000-0000-000000000000/resolve')
      .set(authAdmin())
      .send({ status: 'rejected' })
      .expect(404);
    // status resolve invalid -> 400.
    await request(app.getHttpServer())
      .post(`/disputes/${id}/resolve`)
      .set(authAdmin())
      .send({ status: 'open' })
      .expect(400);
  });
});
