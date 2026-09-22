process.env.DB_DRIVER = 'sqljs';
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '7d';

import { ForbiddenException, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { assertOwnerOrAdmin, isOwnerOrAdmin } from '../src/auth/ownership';
import { User } from '../src/users/user.entity';

describe('RBAC AD-01 (e2e)', () => {
  let app: INestApplication;
  let users: Repository<User>;
  const ts = Date.now();
  const userEmail = `rbac_user_${ts}@example.com`;
  const ownerEmail = `rbac_owner_${ts}@example.com`;
  const adminEmail = `rbac_admin_${ts}@example.com`;
  const password = 'Password123!';

  let userToken: string;
  let ownerToken: string;
  let adminToken: string;
  let userId: string;
  let ownerId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    users = app.get<Repository<User>>(getRepositoryToken(User));
  });

  it('register default role = user + GET /me memuat role', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: userEmail, password })
      .expect(201);
    expect(res.body.user.role).toBe('user');
    userToken = res.body.accessToken;
    userId = res.body.user.id;

    const me = await request(app.getHttpServer())
      .get('/me')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect(me.body.role).toBe('user');
  });

  it('GET /admin/ping tanpa token -> 401', async () => {
    await request(app.getHttpServer()).get('/admin/ping').expect(401);
  });

  it('user biasa GET /admin/ping -> 403', async () => {
    await request(app.getHttpServer())
      .get('/admin/ping')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);
  });

  it('venue_owner GET /admin/ping -> 403 (hanya super_admin)', async () => {
    const reg = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: ownerEmail, password })
      .expect(201);
    ownerId = reg.body.user.id;
    await users.update({ id: ownerId }, { role: 'venue_owner' });
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: ownerEmail, password })
      .expect(200);
    expect(login.body.user.role).toBe('venue_owner');
    ownerToken = login.body.accessToken;
    await request(app.getHttpServer())
      .get('/admin/ping')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(403);
  });

  it('super_admin GET /admin/ping -> 200', async () => {
    const reg = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: adminEmail, password })
      .expect(201);
    await users.update({ id: reg.body.user.id }, { role: 'super_admin' });
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminEmail, password })
      .expect(200);
    expect(login.body.user.role).toBe('super_admin');
    adminToken = login.body.accessToken;
    const res = await request(app.getHttpServer())
      .get('/admin/ping')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.role).toBe('super_admin');
  });

  it('helper ownership BK/MP: owner lolos milik sendiri, 403 milik orang lain, admin lolos semua', () => {
    // Owner atas miliknya sendiri.
    expect(() =>
      assertOwnerOrAdmin({ id: ownerId, role: 'venue_owner' }, ownerId),
    ).not.toThrow();
    // Owner atas milik orang lain → 403.
    try {
      assertOwnerOrAdmin({ id: ownerId, role: 'venue_owner' }, userId);
      throw new Error('seharusnya 403');
    } catch (e) {
      expect(e).toBeInstanceOf(ForbiddenException);
    }
    // Seller pun tunduk aturan yang sama.
    expect(isOwnerOrAdmin({ id: 'x', role: 'seller' }, 'y')).toBe(false);
    expect(isOwnerOrAdmin({ id: 'x', role: 'seller' }, 'x')).toBe(true);
    // Super admin lolos atas milik siapa pun.
    expect(() =>
      assertOwnerOrAdmin({ id: 'admin-id', role: 'super_admin' }, userId),
    ).not.toThrow();
    expect(isOwnerOrAdmin({ id: 'admin-id', role: 'super_admin' }, ownerId)).toBe(true);
  });

  afterAll(async () => {
    await app.close();
  });
});
