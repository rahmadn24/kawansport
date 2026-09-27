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
import { EloRating } from '../src/elo/elo-rating.entity';

/**
 * EL-01: filter ELO di GET /users/search.
 *
 * Rating di-seed LANGSUNG via repo (deterministik — rumus ELO sendiri
 * sudah diuji di elo-foundation.e2e-spec.ts):
 * - seeker S: badminton 1100 (12 match, non-provisional) → default ±100 = [1000, 1200]
 * - A: badminton 1150 (12 match) → dalam default, provisional=false
 * - B: badminton 1400 (15 match) → luar default
 * - C: tanpa baris rating → efektif 1000 provisional → dalam default (batas bawah inklusif)
 * - D: futsal 1300 SAJA → untuk cabor badminton efektif 1000 provisional
 */
describe('Users search ELO filter (e2e) EL-01', () => {
  let app: INestApplication;
  let ratings: Repository<EloRating>;
  const stamp = Date.now();
  const password = 'Password123!';

  let seekerToken: string;
  const emails = {
    seeker: `el01_seeker_${stamp}@example.com`,
    a: `el01_a_${stamp}@example.com`,
    b: `el01_b_${stamp}@example.com`,
    c: `el01_c_${stamp}@example.com`,
    d: `el01_d_${stamp}@example.com`,
  };
  const ids: Record<string, string> = {};

  const register = async (email: string, displayName: string) => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, displayName })
      .expect(201);
    return res.body as { user: { id: string }; accessToken: string };
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    ratings = app.get<Repository<EloRating>>(getRepositoryToken(EloRating));

    const seeker = await register(emails.seeker, 'EL01 Seeker');
    seekerToken = seeker.accessToken;
    ids.seeker = seeker.user.id;
    const profiles: Array<{ key: string; sports: string[] }> = [
      { key: 'a', sports: ['Badminton'] },
      { key: 'b', sports: ['Badminton'] },
      { key: 'c', sports: ['Badminton'] },
      { key: 'd', sports: ['Futsal'] },
    ];
    for (const p of profiles) {
      const reg = await register(
        emails[p.key as keyof typeof emails],
        `EL01 ${p.key.toUpperCase()}`,
      );
      ids[p.key] = reg.user.id;
      await request(app.getHttpServer())
        .patch('/me')
        .set({ Authorization: `Bearer ${reg.accessToken}` })
        .send({ sports: p.sports })
        .expect(200);
    }

    await ratings.save([
      ratings.create({ userId: ids.seeker, sport: 'badminton', score: 1100, matchesPlayed: 12 }),
      ratings.create({ userId: ids.a, sport: 'badminton', score: 1150, matchesPlayed: 12 }),
      ratings.create({ userId: ids.b, sport: 'badminton', score: 1400, matchesPlayed: 15 }),
      ratings.create({ userId: ids.d, sport: 'futsal', score: 1300, matchesPlayed: 11 }),
    ]);
  });

  const auth = () => ({ Authorization: `Bearer ${seekerToken}` });
  const srv = () => request(app.getHttpServer());
  const byEmail = (rows: Array<{ email: string }>) => rows.map((r) => r.email).sort();

  it('eloSport saja -> default skorku ±100 + badge elo + provisional ditandai', async () => {
    const res = await srv()
      .get('/users/search')
      .query({ eloSport: 'badminton' })
      .set(auth())
      .expect(200);
    // Default [1000, 1200]: A(1150), C(1000 prov), D(1000 prov); B(1400) gugur.
    expect(byEmail(res.body.data)).toEqual([emails.a, emails.c, emails.d].sort());
    expect(res.body.meta.total).toBe(3);
    expect(res.body.data.map((u: { email: string }) => u.email)).not.toContain(emails.seeker);
    const badgeOf = (email: string) =>
      (res.body.data as Array<{ email: string; elo: { sport: string; score: number; provisional: boolean } }>).find(
        (u) => u.email === email,
      )!.elo;
    expect(badgeOf(emails.a)).toEqual({ sport: 'badminton', score: 1150, provisional: false });
    expect(badgeOf(emails.c)).toEqual({ sport: 'badminton', score: 1000, provisional: true });
    expect(badgeOf(emails.d)).toEqual({ sport: 'badminton', score: 1000, provisional: true });
  });

  it('eloSport case-insensitive (BADMINTON = badminton)', async () => {
    const res = await srv()
      .get('/users/search')
      .query({ eloSport: 'BADMINTON' })
      .set(auth())
      .expect(200);
    expect(byEmail(res.body.data)).toEqual([emails.a, emails.c, emails.d].sort());
  });

  it('eloMaxDelta memperlebar rentang dari skorku', async () => {
    const res = await srv()
      .get('/users/search')
      .query({ eloSport: 'badminton', eloMaxDelta: 500 })
      .set(auth())
      .expect(200);
    // [600, 1600]: semua ikut termasuk B(1400).
    expect(byEmail(res.body.data)).toEqual([emails.a, emails.b, emails.c, emails.d].sort());
    expect(res.body.meta.total).toBe(4);
  });

  it('eloMin/eloMax eksplisit mengalahkan default', async () => {
    const res = await srv()
      .get('/users/search')
      .query({ eloSport: 'badminton', eloMin: 1100, eloMax: 1200 })
      .set(auth())
      .expect(200);
    expect(byEmail(res.body.data)).toEqual([emails.a]);
    expect(res.body.meta.total).toBe(1);
  });

  it('satu batas saja: sisi lain tak dibatasi', async () => {
    const res = await srv()
      .get('/users/search')
      .query({ eloSport: 'badminton', eloMin: 1300 })
      .set(auth())
      .expect(200);
    expect(byEmail(res.body.data)).toEqual([emails.b]);
  });

  it('kombinasi filter sport profil + eloSport', async () => {
    const res = await srv()
      .get('/users/search')
      .query({ sport: 'Futsal', eloSport: 'badminton' })
      .set(auth())
      .expect(200);
    // Hanya D yang profilnya Futsal (skor badminton efektif 1000, dalam default).
    expect(byEmail(res.body.data)).toEqual([emails.d]);
  });

  it('tanpa eloSport -> tiap item TANPA properti elo', async () => {
    const res = await srv().get('/users/search').set(auth()).expect(200);
    expect(res.body.meta.total).toBe(4);
    for (const u of res.body.data as Array<{ elo?: unknown }>) {
      expect(u).not.toHaveProperty('elo');
    }
  });

  it('validasi: batas tanpa eloSport -> 400; eloMin > eloMax -> 400', async () => {
    await srv().get('/users/search').query({ eloMin: 1000 }).set(auth()).expect(400);
    await srv().get('/users/search').query({ eloMaxDelta: 50 }).set(auth()).expect(400);
    await srv()
      .get('/users/search')
      .query({ eloSport: 'badminton', eloMin: 1500, eloMax: 1200 })
      .set(auth())
      .expect(400);
  });

  it('tanpa token -> 401', async () => {
    await srv().get('/users/search').query({ eloSport: 'badminton' }).expect(401);
  });

  afterAll(async () => {
    await app.close();
  });
});
