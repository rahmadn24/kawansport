process.env.DB_DRIVER = 'sqljs';
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '7d';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * SM-06: seed 3 user lokasi beda + 1 seeker; cek order jarak + filter
 * sport/skill + pagination + exclude self.
 *
 * Titik (semua lat -6.2, lng berjenjang ke timur dari seeker 106.8):
 * - A "near" 106.81  (~1.1 km) futsal/intermediate
 * - B "mid"  106.85  (~5.5 km) futsal/beginner
 * - C "far"  106.90  (~11 km)  basket/intermediate
 */
describe('Users search (e2e) SM-06', () => {
  let app: INestApplication;
  const stamp = Date.now();
  const password = 'Password123!';

  const seekerEmail = `sm06_seeker_${stamp}@example.com`;
  let seekerToken: string;

  const seed: Array<{
    email: string;
    displayName: string;
    sports: string[];
    skillLevel: string;
    lat: number;
    lng: number;
    token?: string;
  }> = [
    {
      email: `sm06_a_${stamp}@example.com`,
      displayName: 'SM06 A Near',
      sports: ['Futsal'],
      skillLevel: 'intermediate',
      lat: -6.2,
      lng: 106.81,
    },
    {
      email: `sm06_b_${stamp}@example.com`,
      displayName: 'SM06 B Mid',
      sports: ['Futsal'],
      skillLevel: 'beginner',
      lat: -6.2,
      lng: 106.85,
    },
    {
      email: `sm06_c_${stamp}@example.com`,
      displayName: 'SM06 C Far',
      sports: ['Basket'],
      skillLevel: 'intermediate',
      lat: -6.2,
      lng: 106.9,
    },
  ];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    const seeker = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: seekerEmail, password, displayName: 'SM06 Seeker' })
      .expect(201);
    seekerToken = seeker.body.accessToken;
    // Seeker di pusat lingkaran pencarian.
    await request(app.getHttpServer())
      .patch('/me')
      .set({ Authorization: `Bearer ${seekerToken}` })
      .send({ lat: -6.2, lng: 106.8, sports: ['Futsal'], skillLevel: 'intermediate' })
      .expect(200);

    for (const u of seed) {
      const reg = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: u.email, password, displayName: u.displayName })
        .expect(201);
      u.token = reg.body.accessToken;
      await request(app.getHttpServer())
        .patch('/me')
        .set({ Authorization: `Bearer ${u.token}` })
        .send({ sports: u.sports, skillLevel: u.skillLevel, lat: u.lat, lng: u.lng })
        .expect(200);
    }
  });

  const auth = () => ({ Authorization: `Bearer ${seekerToken}` });
  const srv = () => request(app.getHttpServer());

  it('hasil terurut jarak ASC + exclude self + ada distanceMeters', async () => {
    const res = await srv()
      .get('/users/search')
      .query({ lat: -6.2, lng: 106.8, radius: 50000 })
      .set(auth())
      .expect(200);
    const emails = (res.body.data as Array<{ email: string }>).map((u) => u.email);
    expect(emails).toEqual([seed[0].email, seed[1].email, seed[2].email]);
    expect(emails).not.toContain(seekerEmail);
    const dists = (res.body.data as Array<{ distanceMeters: number }>).map(
      (u) => u.distanceMeters,
    );
    expect(dists.length).toBe(3);
    expect(dists[0]).toBeLessThan(dists[1]);
    expect(dists[1]).toBeLessThan(dists[2]);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 20, total: 3 });
  });

  it('radius kecil hanya mengembalikan yang dekat', async () => {
    const res = await srv()
      .get('/users/search')
      .query({ lat: -6.2, lng: 106.8, radius: 2000 })
      .set(auth())
      .expect(200);
    expect(res.body.data.map((u: { email: string }) => u.email)).toEqual([seed[0].email]);
    expect(res.body.meta.total).toBe(1);
  });

  it('filter sport overlap case-insensitive', async () => {
    const res = await srv()
      .get('/users/search')
      .query({ lat: -6.2, lng: 106.8, radius: 50000, sport: 'futsal' })
      .set(auth())
      .expect(200);
    expect(res.body.data.map((u: { email: string }) => u.email)).toEqual([
      seed[0].email,
      seed[1].email,
    ]);
  });

  it('filter skill persis', async () => {
    const res = await srv()
      .get('/users/search')
      .query({ lat: -6.2, lng: 106.8, radius: 50000, skill: 'intermediate' })
      .set(auth())
      .expect(200);
    expect(res.body.data.map((u: { email: string }) => u.email)).toEqual([
      seed[0].email,
      seed[2].email,
    ]);
  });

  it('kombinasi sport + skill', async () => {
    const res = await srv()
      .get('/users/search')
      .query({ lat: -6.2, lng: 106.8, radius: 50000, sport: 'Futsal', skill: 'beginner' })
      .set(auth())
      .expect(200);
    expect(res.body.data.map((u: { email: string }) => u.email)).toEqual([seed[1].email]);
  });

  it('pagination page/limit + meta.total benar', async () => {
    const base = { lat: -6.2, lng: 106.8, radius: 50000, limit: 1 };
    const p1 = await srv().get('/users/search').query({ ...base, page: 1 }).set(auth()).expect(200);
    const p2 = await srv().get('/users/search').query({ ...base, page: 2 }).set(auth()).expect(200);
    const p3 = await srv().get('/users/search').query({ ...base, page: 3 }).set(auth()).expect(200);
    expect(p1.body.data.map((u: { email: string }) => u.email)).toEqual([seed[0].email]);
    expect(p2.body.data.map((u: { email: string }) => u.email)).toEqual([seed[1].email]);
    expect(p3.body.data.map((u: { email: string }) => u.email)).toEqual([seed[2].email]);
    for (const r of [p1, p2, p3]) {
      expect(r.body.meta.total).toBe(3);
      expect(r.body.meta.limit).toBe(1);
    }
    expect(p1.body.meta.page).toBe(1);
    expect(p2.body.meta.page).toBe(2);
  });

  it('tanpa geo tetap exclude self + filter sport jalan', async () => {
    const res = await srv()
      .get('/users/search')
      .query({ sport: 'Futsal' })
      .set(auth())
      .expect(200);
    const emails = (res.body.data as Array<{ email: string }>).map((u) => u.email);
    // Seeker juga punya Futsal tapi harus ter-exclude.
    expect(emails).not.toContain(seekerEmail);
    expect(emails).toContain(seed[0].email);
    expect(emails).toContain(seed[1].email);
    expect(emails).not.toContain(seed[2].email);
  });

  it('validasi: lat tanpa lng -> 400; skill salah -> 400', async () => {
    await srv().get('/users/search').query({ lat: -6.2 }).set(auth()).expect(400);
    await srv().get('/users/search').query({ skill: 'pro' }).set(auth()).expect(400);
  });

  it('tanpa token -> 401', async () => {
    await srv().get('/users/search').query({ lat: -6.2, lng: 106.8 }).expect(401);
  });

  afterAll(async () => {
    await app.close();
  });
});
