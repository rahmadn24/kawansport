process.env.DB_DRIVER = 'sqljs';
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '7d';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { User } from '../src/users/user.entity';

describe('Ratings (e2e)', () => {
  let app: INestApplication;
  let users: Repository<User>;
  const ts = Date.now();
  const password = 'Password123!';

  let ownerToken: string;
  let userAToken: string;
  let userAId: string;
  let userBToken: string;
  let adminToken: string;

  let venueId: string;
  let ratingId: string;

  const authOwner = () => ({ Authorization: `Bearer ${ownerToken}` });
  const authA = () => ({ Authorization: `Bearer ${userAToken}` });
  const authB = () => ({ Authorization: `Bearer ${userBToken}` });
  const authAdmin = () => ({ Authorization: `Bearer ${adminToken}` });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    users = app.get<Repository<User>>(getRepositoryToken(User));

    // Venue owner.
    const regOwner = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `rt_owner_${ts}@example.com`, password })
      .expect(201);
    await users.update({ id: regOwner.body.user.id }, { role: 'venue_owner' });
    ownerToken = (
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: `rt_owner_${ts}@example.com`, password })
        .expect(200)
    ).body.accessToken;

    // User A (reviewer) + user B (orang lain).
    const regA = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `rt_usera_${ts}@example.com`, password, displayName: 'Reviewer A' })
      .expect(201);
    userAToken = regA.body.accessToken;
    userAId = regA.body.user.id;

    userBToken = (
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: `rt_userb_${ts}@example.com`, password })
        .expect(201)
    ).body.accessToken;

    // Super admin.
    const regAdmin = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `rt_admin_${ts}@example.com`, password })
      .expect(201);
    await users.update({ id: regAdmin.body.user.id }, { role: 'super_admin' });
    adminToken = (
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: `rt_admin_${ts}@example.com`, password })
        .expect(200)
    ).body.accessToken;

    // Venue milik owner + approve agar realistis.
    const venue = await request(app.getHttpServer())
      .post('/venues')
      .set(authOwner())
      .send({
        name: 'GOR Rating Test',
        address: 'Jl. Test No. 1',
        lat: -6.2,
        lng: 106.8,
        sports: ['Futsal'],
      })
      .expect(201);
    venueId = venue.body.id;
    await request(app.getHttpServer())
      .post(`/venues/${venueId}/approve`)
      .set(authAdmin())
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /ratings tanpa token -> 401', async () => {
    await request(app.getHttpServer())
      .post('/ratings')
      .send({ venueId, score: 5 })
      .expect(401);
  });

  it('POST /ratings user login biasa -> 201 (email tidak terekspos)', async () => {
    const res = await request(app.getHttpServer())
      .post('/ratings')
      .set(authA())
      .send({ venueId, score: 5, comment: 'Lapangan bagus!' })
      .expect(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.userId).toBe(userAId);
    expect(res.body.score).toBe(5);
    expect(res.body.review).toMatchObject({ comment: 'Lapangan bagus!' });
    expect(res.body.user).toBeDefined();
    expect(res.body.user).not.toHaveProperty('email');
    expect(res.body.user).toHaveProperty('displayName');
    expect(res.body.user).toHaveProperty('avatarUrl');
    ratingId = res.body.id;
  });

  it('POST /ratings score di luar 1-5 -> 400', async () => {
    // Venue kedua agar tidak kena 409 duplikat.
    const v2 = await request(app.getHttpServer())
      .post('/venues')
      .set(authOwner())
      .send({
        name: 'GOR Rating Validasi',
        address: 'Jl. Test No. 2',
        lat: -6.2,
        lng: 106.8,
        sports: ['Futsal'],
      })
      .expect(201);
    await request(app.getHttpServer())
      .post('/ratings')
      .set(authA())
      .send({ venueId: v2.body.id, score: 6 })
      .expect(400);
    await request(app.getHttpServer())
      .post('/ratings')
      .set(authA())
      .send({ venueId: v2.body.id, score: 0 })
      .expect(400);
  });

  it('POST /ratings duplikat user+venue -> 409', async () => {
    await request(app.getHttpServer())
      .post('/ratings')
      .set(authA())
      .send({ venueId, score: 4 })
      .expect(409);
  });

  it('GET /ratings/venues/:venueId/ratings -> 200 + pagination, tanpa email', async () => {
    const res = await request(app.getHttpServer())
      .get(`/ratings/venues/${venueId}/ratings`)
      .query({ page: 1, limit: 10 })
      .expect(200);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 10, total: 1 });
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(ratingId);
    expect(res.body.data[0].user).not.toHaveProperty('email');
  });

  it('GET /ratings/:id -> 200 detail tanpa email', async () => {
    const res = await request(app.getHttpServer()).get(`/ratings/${ratingId}`).expect(200);
    expect(res.body.id).toBe(ratingId);
    expect(res.body.score).toBe(5);
    expect(res.body.user).not.toHaveProperty('email');
  });

  it('PUT /ratings/:id milik sendiri -> 200', async () => {
    const res = await request(app.getHttpServer())
      .put(`/ratings/${ratingId}`)
      .set(authA())
      .send({ score: 4, comment: 'Masih bagus' })
      .expect(200);
    expect(res.body.score).toBe(4);
    expect(res.body.review).toMatchObject({ comment: 'Masih bagus' });
    expect(res.body.user).not.toHaveProperty('email');
  });

  it('PUT /ratings/:id milik orang lain -> 403', async () => {
    await request(app.getHttpServer())
      .put(`/ratings/${ratingId}`)
      .set(authB())
      .send({ score: 1 })
      .expect(403);
  });

  it('DELETE /ratings/:id orang lain -> 403', async () => {
    await request(app.getHttpServer())
      .delete(`/ratings/${ratingId}`)
      .set(authB())
      .expect(403);
  });

  it('DELETE /ratings/:id owner -> 204, lalu GET -> 404', async () => {
    await request(app.getHttpServer())
      .delete(`/ratings/${ratingId}`)
      .set(authA())
      .expect(204);
    await request(app.getHttpServer()).get(`/ratings/${ratingId}`).expect(404);
  });

  it('DELETE /ratings/:id oleh admin -> 204', async () => {
    const created = await request(app.getHttpServer())
      .post('/ratings')
      .set(authB())
      .send({ venueId, score: 3 })
      .expect(201);
    await request(app.getHttpServer())
      .delete(`/ratings/${created.body.id}`)
      .set(authAdmin())
      .expect(204);
    await request(app.getHttpServer()).get(`/ratings/${created.body.id}`).expect(404);
  });
});
