process.env.DB_DRIVER = 'sqljs';
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '7d';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Auth (e2e) SM-02', () => {
  let app: INestApplication;
  const email = `sm02_${Date.now()}@example.com`;
  const password = 'Password123!';

  let accessToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  it('POST /auth/register -> 201 + token pair', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, displayName: 'SM02 User' })
      .expect(201);
    expect(res.body.user.email).toBe(email);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  it('POST /auth/register duplikat -> 409', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password })
      .expect(409);
  });

  it('GET /me tanpa token -> 401', async () => {
    await request(app.getHttpServer()).get('/me').expect(401);
  });

  it('GET /me dengan token -> 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body.email).toBe(email);
  });

  it('POST /auth/login -> 200 + token pair baru', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    expect(res.body.accessToken).toBeDefined();
    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  it('POST /auth/login password salah -> 401', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'wrong-password' })
      .expect(401);
  });

  it('POST /auth/refresh rotasi -> 200, refresh lama hangus', async () => {
    const oldRefresh = refreshToken;
    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: oldRefresh })
      .expect(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).not.toBe(oldRefresh);
    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;

    // Token lama yang sudah diputarkan harus ditolak.
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: oldRefresh })
      .expect(401);
  });

  it('POST /auth/logout -> 200, refresh tidak bisa dipakai lagi', async () => {
    await request(app.getHttpServer())
      .post('/auth/logout')
      .send({ refreshToken })
      .expect(200);
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });

  it('GET /health tetap OK', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
  });

  afterAll(async () => {
    await app.close();
  });
});
