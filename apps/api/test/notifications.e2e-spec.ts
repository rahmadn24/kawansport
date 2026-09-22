process.env.DB_DRIVER = 'sqljs';
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '7d';
// Hindari panggilan jaringan ke FCM selama e2e.
process.env.FIREBASE_STUB = 'true';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { User } from '../src/users/user.entity';

describe('Notifications PH3-03 (e2e)', () => {
  let app: INestApplication;
  let users: Repository<User>;
  const ts = Date.now();
  const userEmail = `notif_user_${ts}@example.com`;
  const adminEmail = `notif_admin_${ts}@example.com`;
  const password = 'Password123!';

  let userToken: string;
  let userId: string;
  let adminToken: string;
  let adminId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    users = app.get<Repository<User>>(getRepositoryToken(User));

    const userReg = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: userEmail, password })
      .expect(201);
    userToken = userReg.body.accessToken;
    userId = userReg.body.user.id;

    const adminReg = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: adminEmail, password })
      .expect(201);
    adminId = adminReg.body.user.id;
    await users.update({ id: adminId }, { role: 'super_admin' });
    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminEmail, password })
      .expect(200);
    adminToken = adminLogin.body.accessToken;
  });

  it('POST /notifications/register 200 (user login)', async () => {
    const res = await request(app.getHttpServer())
      .post('/notifications/register')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        token: `fcm-test-token-${ts}`,
        platform: 'android',
        deviceId: 'device-1',
        appVersion: '1.0.0',
      })
      .expect(200);
    expect(res.body.token).toBe(`fcm-test-token-${ts}`);
    expect(res.body.userId).toBe(userId);
  });

  it('POST /notifications/register tanpa token -> 401', async () => {
    await request(app.getHttpServer())
      .post('/notifications/register')
      .send({ token: 'fcm-token-x', platform: 'android' })
      .expect(401);
  });

  it('POST /notifications/send tanpa admin -> 403', async () => {
    await request(app.getHttpServer())
      .post('/notifications/send')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ userIds: [userId], title: 'Hi', body: 'Hello' })
      .expect(403);
  });

  it('POST /notifications/send sebagai admin -> 200 { sent, failed }', async () => {
    const res = await request(app.getHttpServer())
      .post('/notifications/send')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userIds: [userId],
        title: 'Halo',
        body: 'Test push',
        data: { type: 'system' },
      })
      .expect(200);
    expect(typeof res.body.sent).toBe('number');
    expect(typeof res.body.failed).toBe('number');
    expect(res.body.sent).toBeGreaterThanOrEqual(1);
  });

  afterAll(async () => {
    await app.close();
  });
});
