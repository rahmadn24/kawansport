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
import { EloHistory } from '../src/elo/elo-history.entity';
import { EloRating } from '../src/elo/elo-rating.entity';
import { User } from '../src/users/user.entity';

/** Mirror rumus EL-00 (independen) untuk hitungan ekspektasi di test. */
function expectedEa(ra: number, rb: number): number {
  return 1 / (1 + Math.pow(10, (rb - ra) / 400));
}

const DAY_MS = 86_400_000;
const daysAgo = (days: number): Date => new Date(Date.now() - days * DAY_MS);

describe('ELO follow-up EL-05 (e2e): dispute-match + walkover + decay + provisional', () => {
  let app: INestApplication;
  let users: Repository<User>;
  let ratings: Repository<EloRating>;
  let history: Repository<EloHistory>;
  const ts = Date.now();
  const password = 'Password123!';

  const ids: Record<string, string> = {};
  const tokens: Record<string, string> = {};

  const register = async (tag: string) => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `el05_${tag}_${ts}@example.com`, password })
      .expect(201);
    ids[tag] = res.body.user.id as string;
    tokens[tag] = res.body.accessToken as string;
  };

  const auth = (tag: string) => ({ Authorization: `Bearer ${tokens[tag]}` });

  const createMatch = async (
    tag: string,
    body: Record<string, unknown>,
  ): Promise<{ id: string; status: string }> => {
    const res = await request(app.getHttpServer())
      .post('/matches')
      .set(auth(tag))
      .send(body)
      .expect(201);
    return { id: res.body.id as string, status: res.body.status as string };
  };

  const confirm = async (tag: string, matchId: string, status = 200) => {
    const res = await request(app.getHttpServer())
      .post(`/matches/${matchId}/confirm`)
      .set(auth(tag))
      .expect(status);
    return res.body as { status: string };
  };

  const ratingOf = (userId: string, sport: string) =>
    ratings.findOne({ where: { userId, sport } });

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
    ratings = app.get<Repository<EloRating>>(getRepositoryToken(EloRating));
    history = app.get<Repository<EloHistory>>(getRepositoryToken(EloHistory));

    for (const tag of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k']) {
      await register(tag);
    }
    // Jadikan `adm` super_admin (perlu login ulang agar klaim role baru).
    await register('adm');
    await users.update({ id: ids.adm }, { role: 'super_admin' });
    tokens.adm = (
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: `el05_adm_${ts}@example.com`, password })
        .expect(200)
    ).body.accessToken as string;
  });

  afterAll(async () => {
    await app.close();
  });

  it('dispute center targetType match: validasi 400/404/403 + auto-disputed', async () => {
    const m = await createMatch('a', {
      sport: 'badminton',
      teamA: [ids.a],
      teamB: [ids.b],
      scoreA: 21,
      scoreB: 15,
    });
    expect(m.status).toBe('pending');

    // targetId bukan UUID → 400.
    await request(app.getHttpServer())
      .post('/disputes')
      .set(auth('a'))
      .send({
        targetType: 'match',
        targetId: 'bukan-uuid',
        category: 'other',
        description: 'Skor diprotes',
      })
      .expect(400);
    // UUID tak dikenal → 404.
    await request(app.getHttpServer())
      .post('/disputes')
      .set(auth('a'))
      .send({
        targetType: 'match',
        targetId: '00000000-0000-0000-0000-000000000000',
        category: 'other',
        description: 'Skor diprotes',
      })
      .expect(404);
    // Bukan pemain (C) → 403; match tetap pending.
    await request(app.getHttpServer())
      .post('/disputes')
      .set(auth('c'))
      .send({
        targetType: 'match',
        targetId: m.id,
        category: 'other',
        description: 'Ikut campur',
      })
      .expect(403);

    // Pemain (B) lapor → 201 open + match otomatis disputed.
    const ticket = await request(app.getHttpServer())
      .post('/disputes')
      .set(auth('b'))
      .send({
        targetType: 'match',
        targetId: m.id,
        category: 'other',
        description: 'Skor sebenarnya 21-19 untuk saya',
      })
      .expect(201);
    expect(ticket.body.status).toBe('open');
    expect(ticket.body.targetType).toBe('match');

    const detail = await request(app.getHttpServer())
      .get(`/matches/${m.id}`)
      .set(auth('a'))
      .expect(200);
    expect(detail.body.status).toBe('disputed');

    // Confirm atas disputed → 409 (freeze).
    await confirm('a', m.id, 409);

    // Admin tutup tiket center seperti biasa.
    await request(app.getHttpServer())
      .post(`/disputes/${ticket.body.id}/investigate`)
      .set(auth('adm'))
      .expect(200);
    const resolved = await request(app.getHttpServer())
      .post(`/disputes/${ticket.body.id}/resolve`)
      .set(auth('adm'))
      .send({ status: 'resolved', resolution: 'Skor 21-15 sah' })
      .expect(200);
    expect(resolved.body.status).toBe('resolved');

    // Admin putuskan match: confirm → confirmed + ELO jalan (±24 simetris).
    const done = await request(app.getHttpServer())
      .post(`/matches/${m.id}/resolve-dispute`)
      .set(auth('adm'))
      .send({ decision: 'confirm' })
      .expect(200);
    expect(done.body.status).toBe('confirmed');
    expect((await ratingOf(ids.a, 'badminton'))!.score).toBe(1024);
    expect((await ratingOf(ids.b, 'badminton'))!.score).toBe(976);
    const kinds = (
      await history.find({ where: { userId: ids.a } })
    ).map((h) => h.kind);
    expect(kinds).toContain('match');
  });

  it('resolve-dispute cancel → cancelled tanpa ELO; guard 403/409/400/404', async () => {
    const m = await createMatch('c', {
      sport: 'futsal',
      teamA: [ids.c],
      teamB: [ids.d],
      scoreA: 3,
      scoreB: 3,
    });
    await request(app.getHttpServer())
      .post(`/matches/${m.id}/dispute`)
      .set(auth('d'))
      .expect(200);

    // Non-admin → 403.
    await request(app.getHttpServer())
      .post(`/matches/${m.id}/resolve-dispute`)
      .set(auth('c'))
      .send({ decision: 'confirm' })
      .expect(403);
    // decision invalid → 400.
    await request(app.getHttpServer())
      .post(`/matches/${m.id}/resolve-dispute`)
      .set(auth('adm'))
      .send({ decision: 'maybe' })
      .expect(400);
    // Tak ada → 404.
    await request(app.getHttpServer())
      .post('/matches/00000000-0000-0000-0000-000000000000/resolve-dispute')
      .set(auth('adm'))
      .send({ decision: 'cancel' })
      .expect(404);

    // Cancel → cancelled; rating futsal tak tersentuh.
    const cancelled = await request(app.getHttpServer())
      .post(`/matches/${m.id}/resolve-dispute`)
      .set(auth('adm'))
      .send({ decision: 'cancel' })
      .expect(200);
    expect(cancelled.body.status).toBe('cancelled');
    expect(await ratingOf(ids.c, 'futsal')).toBeNull();
    expect(await ratingOf(ids.d, 'futsal')).toBeNull();

    // Resolve ulang atas cancelled → 409.
    await request(app.getHttpServer())
      .post(`/matches/${m.id}/resolve-dispute`)
      .set(auth('adm'))
      .send({ decision: 'confirm' })
      .expect(409);
  });

  it('resolve-dispute atas pending → 409', async () => {
    const m = await createMatch('a', {
      sport: 'tenis',
      teamA: [ids.a],
      teamB: [ids.b],
      scoreA: 6,
      scoreB: 4,
    });
    await request(app.getHttpServer())
      .post(`/matches/${m.id}/resolve-dispute`)
      .set(auth('adm'))
      .send({ decision: 'confirm' })
      .expect(409);
  });

  it('walkover: super_admin saja; skor WO 21-0 + confirmed + ELO normal', async () => {
    const m = await createMatch('c', {
      sport: 'badminton',
      teamA: [ids.c],
      teamB: [ids.d],
      scoreA: 0,
      scoreB: 0,
    });

    // Pemain biasa → 403 (KEPUTUSAN: super_admin saja).
    await request(app.getHttpServer())
      .post(`/matches/${m.id}/walkover`)
      .set(auth('c'))
      .send({ winnerSide: 'A' })
      .expect(403);
    // winnerSide invalid → 400.
    await request(app.getHttpServer())
      .post(`/matches/${m.id}/walkover`)
      .set(auth('adm'))
      .send({ winnerSide: 'C' })
      .expect(400);

    const wo = await request(app.getHttpServer())
      .post(`/matches/${m.id}/walkover`)
      .set(auth('adm'))
      .send({ winnerSide: 'A' })
      .expect(200);
    expect(wo.body.status).toBe('confirmed');
    expect(wo.body.scoreA).toBe(21);
    expect(wo.body.scoreB).toBe(0);

    // ELO normal 1v1 fresh: pemenang +24, WO −24.
    expect((await ratingOf(ids.c, 'badminton'))!.score).toBe(1024);
    expect((await ratingOf(ids.d, 'badminton'))!.score).toBe(976);
    expect((await ratingOf(ids.c, 'badminton'))!.matchesPlayed).toBe(1);

    // Walkover ulang atas confirmed → 409.
    await request(app.getHttpServer())
      .post(`/matches/${m.id}/walkover`)
      .set(auth('adm'))
      .send({ winnerSide: 'B' })
      .expect(409);
  });

  it('walkover dari disputed (pihak B menang) → skor 0-21', async () => {
    const m = await createMatch('a', {
      sport: 'pingpong',
      teamA: [ids.a],
      teamB: [ids.b],
      scoreA: 5,
      scoreB: 5,
    });
    await request(app.getHttpServer())
      .post(`/matches/${m.id}/dispute`)
      .set(auth('b'))
      .expect(200);

    const wo = await request(app.getHttpServer())
      .post(`/matches/${m.id}/walkover`)
      .set(auth('adm'))
      .send({ winnerSide: 'B' })
      .expect(200);
    expect(wo.body.status).toBe('confirmed');
    expect(wo.body.scoreA).toBe(0);
    expect(wo.body.scoreB).toBe(21);
    // B menang: B naik, A turun (fresh 1000 → ±24).
    expect((await ratingOf(ids.b, 'pingpong'))!.score).toBe(1024);
    expect((await ratingOf(ids.a, 'pingpong'))!.score).toBe(976);
  });

  it('decay oportunistik pada baca: 121 hari → −10; idempoten; lantai 800', async () => {
    await ratings.save(
      ratings.create({
        userId: ids.e,
        sport: 'badminton',
        score: 1200,
        matchesPlayed: 12,
        lastMatchAt: daysAgo(121),
        decayedPeriods: 0,
      }),
    );

    // floor((121−90)/30) = 1 periode → 1200 − 10 = 1190.
    const me = await request(app.getHttpServer())
      .get('/elo/me')
      .set(auth('e'))
      .expect(200);
    expect(me.body.data).toEqual([
      { sport: 'badminton', score: 1190, matchesPlayed: 12, provisional: false },
    ]);

    // Baca ulang → tetap 1190 (idempoten) + tepat 1 baris history decay.
    const me2 = await request(app.getHttpServer())
      .get('/elo/me')
      .set(auth('e'))
      .expect(200);
    expect(me2.body.data[0].score).toBe(1190);
    const decays = await history.find({
      where: { userId: ids.e, sport: 'badminton' },
    });
    expect(decays).toHaveLength(1);
    expect(decays[0]).toMatchObject({
      kind: 'decay',
      matchId: null,
      before: 1200,
      after: 1190,
      delta: -10,
      kFactor: 0,
    });

    // Lantai 800: 805 − 3×10 = 775 → clamp 800 (200 hari → 3 periode).
    await ratings.save(
      ratings.create({
        userId: ids.f,
        sport: 'badminton',
        score: 805,
        matchesPlayed: 20,
        lastMatchAt: daysAgo(200),
        decayedPeriods: 0,
      }),
    );
    const pub = await request(app.getHttpServer())
      .get(`/users/${ids.f}/elo`)
      .expect(200);
    expect(pub.body.data).toEqual([
      { sport: 'badminton', score: 800, matchesPlayed: 20, provisional: false },
    ]);
  });

  it('decay tidak menyentuh: vakum <90 hari, lastMatchAt null', async () => {
    await ratings.save(
      ratings.create({
        userId: ids.g,
        sport: 'badminton',
        score: 1100,
        matchesPlayed: 5,
        lastMatchAt: daysAgo(30),
        decayedPeriods: 0,
      }),
    );
    await ratings.save(
      ratings.create({
        userId: ids.h,
        sport: 'tenis',
        score: 1000,
        matchesPlayed: 3,
        lastMatchAt: null,
        decayedPeriods: 0,
      }),
    );
    const g = await request(app.getHttpServer())
      .get('/elo/me')
      .set(auth('g'))
      .expect(200);
    expect(g.body.data).toEqual([
      { sport: 'badminton', score: 1100, matchesPlayed: 5, provisional: true },
    ]);
    expect(
      await history.count({ where: { userId: ids.g, sport: 'badminton' } }),
    ).toBe(0);
    const h = await request(app.getHttpServer())
      .get(`/users/${ids.h}/elo`)
      .expect(200);
    expect(h.body.data).toEqual([
      { sport: 'tenis', score: 1000, matchesPlayed: 3, provisional: true },
    ]);
    expect(
      await history.count({ where: { userId: ids.h, sport: 'tenis' } }),
    ).toBe(0);
  });

  it('decay sebelum apply match: skor efektif dipakai untuk delta ELO', async () => {
    // H: badminton 1000 (12 match, vakum 121 hari → decay dulu ke 990).
    await ratings.save(
      ratings.create({
        userId: ids.h,
        sport: 'badminton',
        score: 1000,
        matchesPlayed: 12,
        lastMatchAt: daysAgo(121),
        decayedPeriods: 0,
      }),
    );
    const m = await createMatch('h', {
      sport: 'badminton',
      teamA: [ids.h],
      teamB: [ids.i],
      scoreA: 21,
      scoreB: 10,
    });
    const done = await confirm('i', m.id);
    expect(done.status).toBe('confirmed');

    // Hitungan manual dari skor EFEKTIF pasca-decay (H=990, I=1000):
    // H: K=32 (12 match, <2400) → round(32×(1−EA(990,1000)));
    // I: K=48 (provisional) → round(48×(0−EA(1000,990))).
    const deltaH = Math.round(32 * (1 - expectedEa(990, 1000)));
    const deltaI = Math.round(48 * (0 - expectedEa(1000, 990)));
    expect((await ratingOf(ids.h, 'badminton'))!.score).toBe(990 + deltaH);
    expect((await ratingOf(ids.i, 'badminton'))!.score).toBe(1000 + deltaI);
    // Jejak: 1 decay (990) + 1 match untuk H.
    const hRows = await history.find({
      where: { userId: ids.h, sport: 'badminton' },
    });
    expect(hRows.map((r) => r.kind).sort()).toEqual(['decay', 'match']);
    expect(hRows.find((r) => r.kind === 'decay')).toMatchObject({
      before: 1000,
      after: 990,
    });
  });

  it('provisional muncul di semua respons rating: elo/me, publik, search badge, leaderboard', async () => {
    // J venue_owner → buat venue agar match masuk leaderboard.
    await users.update({ id: ids.j }, { role: 'venue_owner' });
    tokens.j = (
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: `el05_j_${ts}@example.com`, password })
        .expect(200)
    ).body.accessToken as string;
    const venueId = (
      await request(app.getHttpServer())
        .post('/venues')
        .set(auth('j'))
        .send({
          name: 'GOR EL05',
          address: 'Jl. Provisional No. 5',
          lat: -6.2,
          lng: 106.8,
          sports: ['badminton'],
        })
        .expect(201)
    ).body.id as string;

    // J vs K di venue → confirmed (J 1 match → provisional).
    const m = await createMatch('j', {
      sport: 'badminton',
      teamA: [ids.j],
      teamB: [ids.k],
      scoreA: 21,
      scoreB: 18,
      venueId,
    });
    await confirm('k', m.id);

    // elo/me + publik.
    const meJ = await request(app.getHttpServer())
      .get('/elo/me')
      .set(auth('j'))
      .expect(200);
    expect(meJ.body.data).toEqual([
      { sport: 'badminton', score: 1024, matchesPlayed: 1, provisional: true },
    ]);
    const pubJ = await request(app.getHttpServer())
      .get(`/users/${ids.j}/elo`)
      .expect(200);
    expect(pubJ.body.data).toEqual(meJ.body.data);

    // Search badge (seeker = A; eloSport tanpa batas → default ±100
    // dari skor A badminton 1024 → [924, 1124]; J 1024 + K 976 ikut).
    const search = await request(app.getHttpServer())
      .get('/users/search')
      .set(auth('a'))
      .query({ eloSport: 'badminton', limit: 50 })
      .expect(200);
    const badgeOf = (id: string) =>
      (
        res_body_data(search.body) as Array<{
          id: string;
          elo: { sport: string; score: number; provisional: boolean };
        }>
      ).find((u) => u.id === id)!.elo;
    expect(badgeOf(ids.j)).toEqual({
      sport: 'badminton',
      score: 1024,
      provisional: true,
    });
    expect(badgeOf(ids.k)).toEqual({
      sport: 'badminton',
      score: 976,
      provisional: true,
    });

    // Leaderboard dengan filter sport → provisional true;
    // tanpa filter → elo null + provisional null.
    const lb = await request(app.getHttpServer())
      .get(`/venues/${venueId}/leaderboard`)
      .query({ sport: 'badminton' })
      .expect(200);
    const entryJ = (
      lb.body.data as Array<{
        userId: string;
        elo: number | null;
        provisional: boolean | null;
      }>
    ).find((e) => e.userId === ids.j)!;
    expect(entryJ.elo).toBe(1024);
    expect(entryJ.provisional).toBe(true);

    const lbAll = await request(app.getHttpServer())
      .get(`/venues/${venueId}/leaderboard`)
      .expect(200);
    for (const e of lbAll.body.data as Array<{
      elo: number | null;
      provisional: boolean | null;
    }>) {
      expect(e.elo).toBeNull();
      expect(e.provisional).toBeNull();
    }
  });

  it('stats winRate REAL dari match confirmed (TODO-EL-00 ditutup)', async () => {
    // J: 1 menang (vs K di atas) → winRate 1; K: 1 kalah → 0.
    const statsJ = await request(app.getHttpServer())
      .get(`/users/${ids.j}/stats`)
      .set(auth('a'))
      .expect(200);
    expect(statsJ.body).toMatchObject({
      totalMatches: 1,
      wins: 1,
      losses: 0,
      draws: 0,
      winRate: 1,
    });
    const statsK = await request(app.getHttpServer())
      .get(`/users/${ids.k}/stats`)
      .set(auth('a'))
      .expect(200);
    expect(statsK.body).toMatchObject({
      totalMatches: 1,
      wins: 0,
      losses: 1,
      draws: 0,
      winRate: 0,
    });
    // E: tanpa match → nol + winRate null (jujur, bukan 0 palsu).
    const statsE = await request(app.getHttpServer())
      .get(`/users/${ids.e}/stats`)
      .set(auth('a'))
      .expect(200);
    expect(statsE.body).toMatchObject({
      totalMatches: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      winRate: null,
    });
    // A: menang 1 (vs B, dispute-confirm) + 1 walkover-kalah (vs B,
    // pingpong) + tenis pending (tidak dihitung) → 1-1-0, winRate 0.5.
    const statsA = await request(app.getHttpServer())
      .get(`/users/${ids.a}/stats`)
      .set(auth('b'))
      .expect(200);
    expect(statsA.body).toMatchObject({
      totalMatches: 2,
      wins: 1,
      losses: 1,
      draws: 0,
      winRate: 0.5,
    });
  });
});

function res_body_data(body: { data: unknown }): Array<{
  id: string;
  elo: { sport: string; score: number; provisional: boolean };
}> {
  return body.data as Array<{
    id: string;
    elo: { sport: string; score: number; provisional: boolean };
  }>;
}
