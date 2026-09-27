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

describe('Tournament mini EL-03 (e2e)', () => {
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
      .send({ email: `tourney_${tag}_${ts}@example.com`, password })
      .expect(201);
    return res.body as { user: { id: string }; accessToken: string };
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
    ratings = app.get<Repository<EloRating>>(getRepositoryToken(EloRating));
    history = app.get<Repository<EloHistory>>(getRepositoryToken(EloHistory));

    for (const tag of ['a', 'b', 'c', 'd', 'outsider', 'adm']) {
      const r = await register(tag);
      ids[tag] = r.user.id;
      tokens[tag] = r.accessToken;
    }
    await users.update({ id: ids.adm }, { role: 'super_admin' });
    tokens.adm = (
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: `tourney_adm_${ts}@example.com`, password })
        .expect(200)
    ).body.accessToken as string;
  });

  afterAll(async () => {
    await app.close();
  });

  const auth = (tag: string) => ({
    Authorization: `Bearer ${tokens[tag]}`,
  });

  it('guard: tanpa token -> 401', async () => {
    await request(app.getHttpServer())
      .post('/tournaments')
      .send({
        name: 'X',
        sport: 'badminton',
        participantIds: [ids.a, ids.b, ids.c],
      })
      .expect(401);
    await request(app.getHttpServer()).get('/tournaments/me').expect(401);
    await request(app.getHttpServer())
      .get('/tournaments/00000000-0000-0000-0000-000000000000')
      .expect(401);
  });

  it('validasi create: <3 peserta/duplikat/UUID invalid/pemain tak ada -> 400/404', async () => {
    // Kurang dari 3 peserta.
    await request(app.getHttpServer())
      .post('/tournaments')
      .set(auth('a'))
      .send({
        name: 'Mini',
        sport: 'badminton',
        participantIds: [ids.a, ids.b],
      })
      .expect(400);
    // Duplikat peserta.
    await request(app.getHttpServer())
      .post('/tournaments')
      .set(auth('a'))
      .send({
        name: 'Mini',
        sport: 'badminton',
        participantIds: [ids.a, ids.b, ids.b],
      })
      .expect(400);
    // UUID invalid.
    await request(app.getHttpServer())
      .post('/tournaments')
      .set(auth('a'))
      .send({
        name: 'Mini',
        sport: 'badminton',
        participantIds: [ids.a, ids.b, 'bukan-uuid'],
      })
      .expect(400);
    // Pemain tak ada → 404.
    await request(app.getHttpServer())
      .post('/tournaments')
      .set(auth('a'))
      .send({
        name: 'Mini',
        sport: 'badminton',
        participantIds: [ids.a, ids.b, '00000000-0000-0000-0000-000000000000'],
      })
      .expect(404);
    // Venue tak ada → 404.
    await request(app.getHttpServer())
      .post('/tournaments')
      .set(auth('a'))
      .send({
        name: 'Mini',
        sport: 'badminton',
        venueId: '00000000-0000-0000-0000-000000000000',
        participantIds: [ids.a, ids.b, ids.c],
      })
      .expect(404);
  });

  it('create → draft; creator TIDAK otomatis termasuk (terdokumentasi)', async () => {
    // Creator (a) tidak ikut sebagai peserta — tetap 201.
    const created = await request(app.getHttpServer())
      .post('/tournaments')
      .set(auth('a'))
      .send({
        name: 'Mini Cup',
        sport: 'badminton',
        participantIds: [ids.b, ids.c, ids.d],
      })
      .expect(201);
    expect(created.body.status).toBe('draft');
    expect(created.body.createdBy).toBe(ids.a);
    expect(created.body.participantIds).toEqual([ids.b, ids.c, ids.d]);
    expect(created.body.winnerId).toBeNull();
  });

  let tournamentId = '';
  let fixtureIds: string[] = [];

  it('generate 4 peserta → 6 fixture; lintas-creator 403; idempotent 409', async () => {
    const created = await request(app.getHttpServer())
      .post('/tournaments')
      .set(auth('a'))
      .send({
        name: 'Round Robin',
        sport: 'badminton',
        participantIds: [ids.a, ids.b, ids.c, ids.d],
      })
      .expect(201);
    tournamentId = created.body.id as string;
    expect(created.body.status).toBe('draft');

    // Peserta non-creator generate → 403.
    await request(app.getHttpServer())
      .post(`/tournaments/${tournamentId}/generate`)
      .set(auth('b'))
      .expect(403);

    const generated = await request(app.getHttpServer())
      .post(`/tournaments/${tournamentId}/generate`)
      .set(auth('a'))
      .expect(200);
    expect(generated.body.status).toBe('ongoing');
    const fixtures = generated.body.fixtures as Array<{
      id: string;
      teamA: string[];
      teamB: string[];
      scoreA: number;
      scoreB: number;
      status: string;
      tournamentId: string;
    }>;
    expect(fixtures).toHaveLength(6); // C(4,2) = 6.
    fixtureIds = fixtures.map((f) => f.id);
    for (const f of fixtures) {
      expect(f.teamA).toHaveLength(1);
      expect(f.teamB).toHaveLength(1);
      expect(f.scoreA).toBe(0);
      expect(f.scoreB).toBe(0);
      expect(f.status).toBe('pending');
      expect(f.tournamentId).toBe(tournamentId);
    }
    // Semua pasangan unik tepat sekali.
    const pairs = fixtures
      .map((f) => [...f.teamA, ...f.teamB].sort().join('|'))
      .sort();
    expect(new Set(pairs).size).toBe(6);

    // Generate ulang → 409 + fixture tetap 6 (tanpa duplikat).
    await request(app.getHttpServer())
      .post(`/tournaments/${tournamentId}/generate`)
      .set(auth('a'))
      .expect(409);
    const again = await request(app.getHttpServer())
      .get(`/tournaments/${tournamentId}`)
      .set(auth('a'))
      .expect(200);
    expect(again.body.fixtures).toHaveLength(6);
  });

  it('GET detail + /me: terlibat OK; lintas-user 403; super_admin OK', async () => {
    const detail = await request(app.getHttpServer())
      .get(`/tournaments/${tournamentId}`)
      .set(auth('b'))
      .expect(200);
    expect(detail.body.id).toBe(tournamentId);
    expect(detail.body.fixtures).toHaveLength(6);

    // Outsider → 403.
    await request(app.getHttpServer())
      .get(`/tournaments/${tournamentId}`)
      .set(auth('outsider'))
      .expect(403);
    // Super admin lolos.
    await request(app.getHttpServer())
      .get(`/tournaments/${tournamentId}`)
      .set(auth('adm'))
      .expect(200);
    // Tak ada → 404.
    await request(app.getHttpServer())
      .get('/tournaments/00000000-0000-0000-0000-000000000000')
      .set(auth('a'))
      .expect(404);

    const mine = await request(app.getHttpServer())
      .get('/tournaments/me')
      .set(auth('b'))
      .expect(200);
    expect(
      (mine.body.data as Array<{ id: string }>).map((t) => t.id),
    ).toContain(tournamentId);
    const outsiderMine = await request(app.getHttpServer())
      .get('/tournaments/me')
      .set(auth('outsider'))
      .expect(200);
    expect(
      (outsiderMine.body.data as Array<{ id: string }>).map((t) => t.id),
    ).not.toContain(tournamentId);
  });

  it('score + confirm dua pihak → ELO berubah + history; guard lintas-user', async () => {
    // Cari fixture a vs b.
    const detail = await request(app.getHttpServer())
      .get(`/tournaments/${tournamentId}`)
      .set(auth('a'))
      .expect(200);
    const fixtures = detail.body.fixtures as Array<{
      id: string;
      teamA: string[];
      teamB: string[];
    }>;
    const fab = fixtures.find(
      (f) =>
        (f.teamA[0] === ids.a && f.teamB[0] === ids.b) ||
        (f.teamA[0] === ids.b && f.teamB[0] === ids.a),
    )!;
    expect(fab).toBeDefined();
    const teamASide = fab.teamA[0];
    const teamBSide = fab.teamB[0];
    const tokenA = teamASide === ids.a ? tokens.a : tokens.b;
    const tokenB = teamBSide === ids.a ? tokens.a : tokens.b;
    const headA = { Authorization: `Bearer ${tokenA}` };
    const headB = { Authorization: `Bearer ${tokenB}` };

    // Outsider set skor → 403.
    await request(app.getHttpServer())
      .post(`/matches/${fab.id}/score`)
      .set(auth('outsider'))
      .send({ scoreA: 21, scoreB: 10 })
      .expect(403);
    // Skor negatif → 400.
    await request(app.getHttpServer())
      .post(`/matches/${fab.id}/score`)
      .set(headA)
      .send({ scoreA: -1, scoreB: 10 })
      .expect(400);

    // Pihak teamA input skor → pending + confirmedBy reset [].
    const scored = await request(app.getHttpServer())
      .post(`/matches/${fab.id}/score`)
      .set(headA)
      .send({ scoreA: 21, scoreB: 10 })
      .expect(200);
    expect(scored.body.scoreA).toBe(21);
    expect(scored.body.scoreB).toBe(10);
    expect(scored.body.status).toBe('pending');
    expect(scored.body.confirmedBy).toEqual([]);
    expect(scored.body.tournamentId).toBe(tournamentId);

    // Confirm pihak-1 saja → tetap pending, rating belum berubah.
    const half = await request(app.getHttpServer())
      .post(`/matches/${fab.id}/confirm`)
      .set(headA)
      .expect(200);
    expect(half.body.status).toBe('pending');
    expect(
      await ratings.findOne({ where: { userId: teamASide, sport: 'badminton' } }),
    ).toBeNull();

    // Confirm pihak-2 → confirmed + ELO + history.
    const done = await request(app.getHttpServer())
      .post(`/matches/${fab.id}/confirm`)
      .set(headB)
      .expect(200);
    expect(done.body.status).toBe('confirmed');

    const ra = await ratings.findOne({
      where: { userId: teamASide, sport: 'badminton' },
    });
    const rb = await ratings.findOne({
      where: { userId: teamBSide, sport: 'badminton' },
    });
    expect(ra).not.toBeNull();
    expect(rb).not.toBeNull();
    // K=48 provisional, EA=0.5 → +24/-24.
    expect(ra!.score).toBe(1024);
    expect(rb!.score).toBe(976);
    expect(await history.count({ where: { matchId: fab.id } })).toBe(2);

    // Skor ulang atas confirmed → 409.
    await request(app.getHttpServer())
      .post(`/matches/${fab.id}/score`)
      .set(headA)
      .send({ scoreA: 21, scoreB: 19 })
      .expect(409);
  });

  it('cancel: lintas-user 403; creator OK + fixture pending ikut cancelled', async () => {
    await request(app.getHttpServer())
      .post(`/tournaments/${tournamentId}/cancel`)
      .set(auth('outsider'))
      .expect(403);
    const cancelled = await request(app.getHttpServer())
      .post(`/tournaments/${tournamentId}/cancel`)
      .set(auth('a'))
      .expect(200);
    expect(cancelled.body.status).toBe('cancelled');
    // Cancel ulang → 409.
    await request(app.getHttpServer())
      .post(`/tournaments/${tournamentId}/cancel`)
      .set(auth('a'))
      .expect(409);
    // Fixture pending ikut cancelled; yang confirmed utuh.
    const detail = await request(app.getHttpServer())
      .get(`/tournaments/${tournamentId}`)
      .set(auth('a'))
      .expect(200);
    const fixtures = detail.body.fixtures as Array<{
      id: string;
      status: string;
    }>;
    const confirmedCount = fixtures.filter(
      (f) => f.status === 'confirmed',
    ).length;
    const cancelledCount = fixtures.filter(
      (f) => f.status === 'cancelled',
    ).length;
    expect(confirmedCount).toBe(1);
    expect(cancelledCount).toBe(5);
    expect(fixtureIds).toHaveLength(6);
  });
});
