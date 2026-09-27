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

describe('Venue leaderboard EL-02 (e2e)', () => {
  let app: INestApplication;
  let users: Repository<User>;
  const ts = Date.now();
  const password = 'Password123!';

  let aId: string;
  let bId: string;
  let cId: string;
  let dId: string;
  let aToken: string;
  let bToken: string;
  let cToken: string;
  let dToken: string;
  let venueId: string;
  let emptyVenueId: string;

  const register = async (tag: string, displayName?: string) => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `lb_${tag}_${ts}@example.com`,
        password,
        ...(displayName ? { displayName } : {}),
      })
      .expect(201);
    return res.body as { user: { id: string }; accessToken: string };
  };

  /** Buat match di venue lalu confirm dua pihak (confirmed) atau secukupnya. */
  const createMatch = async (
    token: string,
    body: Record<string, unknown>,
  ): Promise<string> => {
    const res = await request(app.getHttpServer())
      .post('/matches')
      .set({ Authorization: `Bearer ${token}` })
      .send(body)
      .expect(201);
    return res.body.id as string;
  };

  const confirm = async (token: string, matchId: string, status = 200) => {
    const res = await request(app.getHttpServer())
      .post(`/matches/${matchId}/confirm`)
      .set({ Authorization: `Bearer ${token}` })
      .expect(status);
    return res.body as { status: string };
  };

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

    const a = await register('a', 'Andi');
    const b = await register('b', 'Budi');
    const c = await register('c', 'Citra');
    const d = await register('d', 'Dedi');
    aId = a.user.id;
    bId = b.user.id;
    cId = c.user.id;
    dId = d.user.id;
    aToken = a.accessToken;
    bToken = b.accessToken;
    cToken = c.accessToken;
    dToken = d.accessToken;

    // Venue milik A (role venue_owner agar bisa POST /venues).
    await users.update({ id: aId }, { role: 'venue_owner' });
    aToken = (
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: `lb_a_${ts}@example.com`, password })
        .expect(200)
    ).body.accessToken as string;

    const venuePayload = {
      name: 'GOR Leaderboard',
      address: 'Jl. Papan Skor No. 2',
      lat: -6.2,
      lng: 106.8,
      sports: ['badminton'],
    };
    venueId = (
      await request(app.getHttpServer())
        .post('/venues')
        .set({ Authorization: `Bearer ${aToken}` })
        .send(venuePayload)
        .expect(201)
    ).body.id as string;
    emptyVenueId = (
      await request(app.getHttpServer())
        .post('/venues')
        .set({ Authorization: `Bearer ${aToken}` })
        .send({ ...venuePayload, name: 'GOR Kosong' })
        .expect(201)
    ).body.id as string;

    // Match 1 (1v1, badminton, venue): A kalahkan B → confirmed.
    const m1 = await createMatch(aToken, {
      sport: 'badminton',
      teamA: [aId],
      teamB: [bId],
      scoreA: 21,
      scoreB: 15,
      venueId,
    });
    await confirm(bToken, m1);

    // Match 2 (2v2, badminton, venue): A+B kalahkan C+D → confirmed.
    const m2 = await createMatch(aToken, {
      sport: 'badminton',
      teamA: [aId, bId],
      teamB: [cId, dId],
      scoreA: 21,
      scoreB: 19,
      venueId,
    });
    await confirm(cToken, m2);

    // Match 3 (1v1, futsal, venue): C kalahkan D → confirmed (uji filter sport).
    const m3 = await createMatch(cToken, {
      sport: 'futsal',
      teamA: [cId],
      teamB: [dId],
      scoreA: 3,
      scoreB: 1,
      venueId,
    });
    await confirm(dToken, m3);

    // Match 4 (1v1, badminton, venue): pending saja (satu pihak) → dikecualikan.
    await createMatch(cToken, {
      sport: 'badminton',
      teamA: [cId],
      teamB: [dId],
      scoreA: 21,
      scoreB: 20,
      venueId,
    });

    // Match 5 (1v1, badminton, venue): disputed → dikecualikan.
    const m5 = await createMatch(dToken, {
      sport: 'badminton',
      teamA: [aId],
      teamB: [dId],
      scoreA: 5,
      scoreB: 21,
      venueId,
    });
    await request(app.getHttpServer())
      .post(`/matches/${m5}/dispute`)
      .set({ Authorization: `Bearer ${dToken}` })
      .expect(200);

    // Match 6 (1v1, badminton, TANPA venue): A kalahkan B → dikecualikan.
    const m6 = await createMatch(aToken, {
      sport: 'badminton',
      teamA: [aId],
      teamB: [bId],
      scoreA: 21,
      scoreB: 10,
    });
    await confirm(bToken, m6);
  });

  afterAll(async () => {
    await app.close();
  });

  it('publik tanpa token: agregat 1v1+2v2 benar, hanya confirmed venue tsb', async () => {
    const res = await request(app.getHttpServer())
      .get(`/venues/${venueId}/leaderboard`)
      .query({ sport: 'badminton' })
      .expect(200);
    const data = res.body.data as Array<{
      userId: string;
      displayName: string | null;
      played: number;
      wins: number;
      losses: number;
      elo: number | null;
    }>;
    expect(res.body.meta).toMatchObject({
      venueId,
      sport: 'badminton',
      total: 4,
    });
    // A: menang m1 + menang m2 → played 2, wins 2, losses 0 (peringkat 1).
    // B: kalah m1 + menang m2 → played 2, wins 1, losses 1 (peringkat 2).
    // C/D: kalah m2 → played 1, wins 0, losses 1.
    expect(data).toHaveLength(4);
    expect(data[0]).toMatchObject({
      userId: aId,
      displayName: 'Andi',
      played: 2,
      wins: 2,
      losses: 0,
    });
    expect(data[1]).toMatchObject({
      userId: bId,
      displayName: 'Budi',
      played: 2,
      wins: 1,
      losses: 1,
    });
    const tail = data.slice(2).map((r) => r.userId).sort();
    expect(tail).toEqual([cId, dId].sort());
    for (const row of data.slice(2)) {
      expect(row).toMatchObject({ played: 1, wins: 0, losses: 1 });
    }
    // Elo terisi (rating cabor filter saat ini).
    for (const row of data) {
      expect(typeof row.elo).toBe('number');
    }
    expect(data[0].elo).toBeGreaterThan(data[1].elo as number);
  });

  it('tiebreak: wins DESC lalu elo DESC (C vs D seimbang → elo penentu)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/venues/${venueId}/leaderboard`)
      .query({ sport: 'badminton' })
      .expect(200);
    const data = res.body.data as Array<{ userId: string; elo: number | null }>;
    const wins = data.map((r) =>
      r.userId === aId ? 2 : r.userId === bId ? 1 : 0,
    );
    expect(wins).toEqual([2, 1, 0, 0]);
    // C dan D sama-sama 0 win — elo DESC menentukan urutan keduanya.
    const tailElos = data.slice(2).map((r) => r.elo as number);
    expect(tailElos[0]).toBeGreaterThanOrEqual(tailElos[1]);
  });

  it('filter sport: futsal hanya memuat match futsal venue tsb', async () => {
    const res = await request(app.getHttpServer())
      .get(`/venues/${venueId}/leaderboard`)
      .query({ sport: 'futsal' })
      .expect(200);
    const data = res.body.data as Array<{
      userId: string;
      played: number;
      wins: number;
      losses: number;
    }>;
    expect(res.body.meta).toMatchObject({ sport: 'futsal', total: 2 });
    expect(data).toHaveLength(2);
    expect(data[0]).toMatchObject({ userId: cId, played: 1, wins: 1, losses: 0 });
    expect(data[1]).toMatchObject({ userId: dId, played: 1, wins: 0, losses: 1 });
  });

  it('tanpa filter sport: semua cabor venue diagregat, elo → null', async () => {
    const res = await request(app.getHttpServer())
      .get(`/venues/${venueId}/leaderboard`)
      .expect(200);
    // m1 (A>B) + m2 (AB>CD) + m3 futsal (C>D): A played 2 wins 2;
    // B played 2 wins 1; C played 2 wins 1; D played 2 wins 0.
    expect(res.body.meta).toMatchObject({ sport: null, total: 4 });
    const data = res.body.data as Array<{
      userId: string;
      played: number;
      wins: number;
      elo: number | null;
    }>;
    expect(data).toHaveLength(4);
    expect(data[0]).toMatchObject({ userId: aId, played: 2, wins: 2 });
    for (const row of data) {
      expect(row.elo).toBeNull();
    }
  });

  it('limit: baris dipotong tetapi meta.total tetap penuh', async () => {
    const res = await request(app.getHttpServer())
      .get(`/venues/${venueId}/leaderboard`)
      .query({ sport: 'badminton', limit: 2 })
      .expect(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta.total).toBe(4);
    expect(res.body.data[0].userId).toBe(aId);
  });

  it('venue tanpa match → data kosong (jujur, bukan 404)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/venues/${emptyVenueId}/leaderboard`)
      .expect(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta).toMatchObject({ venueId: emptyVenueId, total: 0 });
  });

  it('venue tak ada → 404; UUID invalid → 400; limit invalid → 400', async () => {
    await request(app.getHttpServer())
      .get('/venues/00000000-0000-0000-0000-000000000000/leaderboard')
      .expect(404);
    await request(app.getHttpServer())
      .get('/venues/bukan-uuid/leaderboard')
      .expect(400);
    await request(app.getHttpServer())
      .get(`/venues/${venueId}/leaderboard`)
      .query({ limit: 0 })
      .expect(400);
    await request(app.getHttpServer())
      .get(`/venues/${venueId}/leaderboard`)
      .query({ limit: 101 })
      .expect(400);
  });
});
