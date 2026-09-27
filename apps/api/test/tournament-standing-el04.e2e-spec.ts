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
import { Badge } from '../src/badges/badge.entity';
import { User } from '../src/users/user.entity';

describe('Tournament standing + auto-champion + badge EL-04 (e2e)', () => {
  let app: INestApplication;
  let users: Repository<User>;
  let badges: Repository<Badge>;
  const ts = Date.now();
  const password = 'Password123!';

  const ids: Record<string, string> = {};
  const tokens: Record<string, string> = {};
  const tokenOf = (userId: string) => {
    const tag = Object.keys(ids).find((k) => ids[k] === userId)!;
    return { Authorization: `Bearer ${tokens[tag]}` };
  };

  const register = async (tag: string) => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `el04_${tag}_${ts}@example.com`, password })
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
    badges = app.get<Repository<Badge>>(getRepositoryToken(Badge));

    for (const tag of ['a', 'b', 'c', 'outsider', 'adm']) {
      const r = await register(tag);
      ids[tag] = r.user.id;
      tokens[tag] = r.accessToken;
    }
    await users.update({ id: ids.adm }, { role: 'super_admin' });
    tokens.adm = (
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: `el04_adm_${ts}@example.com`, password })
        .expect(200)
    ).body.accessToken as string;

    // Nama tampilan untuk tiebreak test (a=Zara, b=Mira, c=Aldi).
    await request(app.getHttpServer())
      .patch('/me')
      .set({ Authorization: `Bearer ${tokens.a}` })
      .send({ displayName: 'Zara' })
      .expect(200);
    await request(app.getHttpServer())
      .patch('/me')
      .set({ Authorization: `Bearer ${tokens.b}` })
      .send({ displayName: 'Mira' })
      .expect(200);
    await request(app.getHttpServer())
      .patch('/me')
      .set({ Authorization: `Bearer ${tokens.c}` })
      .send({ displayName: 'Aldi' })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });

  const auth = (tag: string) => ({
    Authorization: `Bearer ${tokens[tag]}`,
  });

  const createTournament = async (name: string) => {
    const res = await request(app.getHttpServer())
      .post('/tournaments')
      .set(auth('a'))
      .send({
        name,
        sport: 'badminton',
        participantIds: [ids.a, ids.b, ids.c],
      })
      .expect(201);
    return res.body.id as string;
  };

  const generate = async (tournamentId: string) => {
    const res = await request(app.getHttpServer())
      .post(`/tournaments/${tournamentId}/generate`)
      .set(auth('a'))
      .expect(200);
    return res.body.fixtures as Array<{
      id: string;
      teamA: string[];
      teamB: string[];
    }>;
  };

  const scoreAndConfirm = async (
    fixtureId: string,
    scoreA: number,
    scoreB: number,
  ) => {
    const detail = await request(app.getHttpServer())
      .get(`/matches/${fixtureId}`)
      .set(auth('adm'))
      .expect(200);
    const teamA = detail.body.teamA[0] as string;
    const teamB = detail.body.teamB[0] as string;
    await request(app.getHttpServer())
      .post(`/matches/${fixtureId}/score`)
      .set(tokenOf(teamA))
      .send({ scoreA, scoreB })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/matches/${fixtureId}/confirm`)
      .set(tokenOf(teamA))
      .expect(200);
    return request(app.getHttpServer())
      .post(`/matches/${fixtureId}/confirm`)
      .set(tokenOf(teamB))
      .expect(200);
  };

  const fixtureOf = (
    fixtures: Array<{ id: string; teamA: string[]; teamB: string[] }>,
    p: string,
    q: string,
  ) =>
    fixtures.find(
      (f) =>
        (f.teamA[0] === ids[p] && f.teamB[0] === ids[q]) ||
        (f.teamA[0] === ids[q] && f.teamB[0] === ids[p]),
    )!;

  it('guard standing: tanpa token 401; lintas-user 403; UUID invalid 400; tak ada 404', async () => {
    const tid = await createTournament('Guard Cup');
    await request(app.getHttpServer())
      .get(`/tournaments/${tid}/standing`)
      .expect(401);
    await request(app.getHttpServer())
      .get(`/tournaments/${tid}/standing`)
      .set(auth('outsider'))
      .expect(403);
    await request(app.getHttpServer())
      .get('/tournaments/bukan-uuid/standing')
      .set(auth('a'))
      .expect(400);
    await request(app.getHttpServer())
      .get('/tournaments/00000000-0000-0000-0000-000000000000/standing')
      .set(auth('a'))
      .expect(404);
  });

  it('standing turnamen draft (tanpa fixture): semua nol + pendingCount 0', async () => {
    const tid = await createTournament('Draft Cup');
    const res = await request(app.getHttpServer())
      .get(`/tournaments/${tid}/standing`)
      .set(auth('b'))
      .expect(200);
    expect(res.body.tournamentId).toBe(tid);
    expect(res.body.status).toBe('draft');
    expect(res.body.winnerId).toBeNull();
    expect(res.body.totalFixtures).toBe(0);
    expect(res.body.confirmedCount).toBe(0);
    expect(res.body.pendingCount).toBe(0);
    expect(res.body.standings).toHaveLength(3);
    for (const row of res.body.standings) {
      expect(row).toMatchObject({
        played: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        points: 0,
        scoreDiff: 0,
      });
    }
  });

  it('standing poin benar + auto-done + winner + badge saat fixture terakhir confirmed', async () => {
    const tid = await createTournament('Points Cup');
    const fixtures = await generate(tid);
    expect(fixtures).toHaveLength(3);

    // Belum ada yang confirmed → semua nol, pendingCount 3.
    const empty = await request(app.getHttpServer())
      .get(`/tournaments/${tid}/standing`)
      .set(auth('a'))
      .expect(200);
    expect(empty.body.pendingCount).toBe(3);
    expect(empty.body.confirmedCount).toBe(0);

    // a vs b: a menang 21-10 (orientasi fixture: teamA=a, teamB=b).
    const fab = fixtureOf(fixtures, 'a', 'b');
    await scoreAndConfirm(fab.id, 21, 10);
    // a vs c: seri 15-15.
    const fac = fixtureOf(fixtures, 'a', 'c');
    await scoreAndConfirm(fac.id, 15, 15);

    // Parsial: a=4pts (1W 1D, diff +11), c=1pt (1D, diff 0), b=0pt (1L, diff -11).
    const partial = await request(app.getHttpServer())
      .get(`/tournaments/${tid}/standing`)
      .set(auth('c'))
      .expect(200);
    expect(partial.body.pendingCount).toBe(1);
    expect(partial.body.confirmedCount).toBe(2);
    expect(partial.body.winnerId).toBeNull();
    const rows = partial.body.standings as Array<Record<string, unknown>>;
    expect(rows.map((r) => r.userId)).toEqual([ids.a, ids.c, ids.b]);
    expect(rows[0]).toMatchObject({
      played: 2,
      wins: 1,
      draws: 1,
      losses: 0,
      points: 4,
      scoreDiff: 11,
      displayName: 'Zara',
    });
    expect(rows[1]).toMatchObject({
      played: 1,
      wins: 0,
      draws: 1,
      losses: 0,
      points: 1,
      scoreDiff: 0,
    });
    expect(rows[2]).toMatchObject({
      played: 1,
      wins: 0,
      draws: 0,
      losses: 1,
      points: 0,
      scoreDiff: -11,
    });
    // Turnamen BELUM done (masih ada pending).
    const stillOngoing = await request(app.getHttpServer())
      .get(`/tournaments/${tid}`)
      .set(auth('a'))
      .expect(200);
    expect(stillOngoing.body.status).toBe('ongoing');
    expect(stillOngoing.body.winnerId).toBeNull();

    // b vs c: b menang 21-19 → fixture terakhir confirmed → auto-done.
    const fbc = fixtureOf(fixtures, 'b', 'c');
    const last = await scoreAndConfirm(fbc.id, 21, 19);
    expect(last.body.status).toBe('confirmed');

    const final = await request(app.getHttpServer())
      .get(`/tournaments/${tid}/standing`)
      .set(auth('a'))
      .expect(200);
    expect(final.body.pendingCount).toBe(0);
    expect(final.body.confirmedCount).toBe(3);
    expect(final.body.winnerId).toBe(ids.a);
    const frows = final.body.standings as Array<Record<string, unknown>>;
    // a=4 (diff +11), b=3 (diff -9), c=1 (diff -2).
    expect(frows.map((r) => r.userId)).toEqual([ids.a, ids.b, ids.c]);
    expect(frows[1]).toMatchObject({ points: 3, scoreDiff: -9 });
    expect(frows[2]).toMatchObject({ points: 1, scoreDiff: -2 });

    const done = await request(app.getHttpServer())
      .get(`/tournaments/${tid}`)
      .set(auth('a'))
      .expect(200);
    expect(done.body.status).toBe('done');
    expect(done.body.winnerId).toBe(ids.a);

    // Badge juara otomatis untuk a (publik + /me).
    const pub = await request(app.getHttpServer())
      .get(`/users/${ids.a}/badges`)
      .expect(200);
    expect(pub.body.data).toHaveLength(1);
    expect(pub.body.data[0]).toMatchObject({
      userId: ids.a,
      kind: 'tournament_champion',
      refId: tid,
    });
    const mine = await request(app.getHttpServer())
      .get('/badges/me')
      .set(auth('a'))
      .expect(200);
    expect(mine.body.data).toHaveLength(1);
    expect(mine.body.data[0].refId).toBe(tid);
    const mineB = await request(app.getHttpServer())
      .get('/badges/me')
      .set(auth('b'))
      .expect(200);
    expect(mineB.body.data).toEqual([]);

    // Idempotent: confirm ulang → 200, badge tetap 1.
    await request(app.getHttpServer())
      .post(`/matches/${fbc.id}/confirm`)
      .set(tokenOf(ids.b))
      .expect(200);
    expect(
      await badges.count({
        where: { userId: ids.a, kind: 'tournament_champion', refId: tid },
      }),
    ).toBe(1);
  });

  it('tiebreak: poin sama → wins → diff → nama (juara = Aldi)', async () => {
    const tid = await createTournament('Tiebreak Cup');
    const fixtures = await generate(tid);
    // Semua menang sekali selisih +1/−1 → semua 3pts/1W/diff 0 → nama ASC.
    await scoreAndConfirm(fixtureOf(fixtures, 'a', 'b').id, 21, 20); // a menang
    await scoreAndConfirm(fixtureOf(fixtures, 'a', 'c').id, 20, 21); // c menang
    await scoreAndConfirm(fixtureOf(fixtures, 'b', 'c').id, 21, 20); // b menang

    const res = await request(app.getHttpServer())
      .get(`/tournaments/${tid}/standing`)
      .set(auth('b'))
      .expect(200);
    const rows = res.body.standings as Array<Record<string, unknown>>;
    expect(rows.map((r) => r.displayName)).toEqual(['Aldi', 'Mira', 'Zara']);
    expect(rows.map((r) => r.userId)).toEqual([ids.c, ids.b, ids.a]);
    for (const row of rows) {
      expect(row).toMatchObject({ points: 3, wins: 1, scoreDiff: 0 });
    }
    expect(res.body.winnerId).toBe(ids.c);
    const done = await request(app.getHttpServer())
      .get(`/tournaments/${tid}`)
      .set(auth('a'))
      .expect(200);
    expect(done.body.status).toBe('done');
    expect(done.body.winnerId).toBe(ids.c);
    const pub = await request(app.getHttpServer())
      .get(`/users/${ids.c}/badges`)
      .expect(200);
    expect(
      (pub.body.data as Array<{ refId: string }>).map((b) => b.refId),
    ).toContain(tid);
  });

  it('disputed memblokir auto-done (tanpa winner/badge)', async () => {
    const tid = await createTournament('Disputed Cup');
    const fixtures = await generate(tid);
    await scoreAndConfirm(fixtureOf(fixtures, 'a', 'b').id, 21, 10);
    await scoreAndConfirm(fixtureOf(fixtures, 'a', 'c').id, 21, 10);
    // Fixture ketiga di-dispute saat pending oleh pesertanya.
    const fbc = fixtureOf(fixtures, 'b', 'c');
    const fbcDetail = await request(app.getHttpServer())
      .get(`/matches/${fbc.id}`)
      .set(auth('adm'))
      .expect(200);
    const disputer =
      fbcDetail.body.teamA[0] === ids.b ? auth('b') : auth('c');
    await request(app.getHttpServer())
      .post(`/matches/${fbc.id}/dispute`)
      .set(disputer)
      .expect(200);

    const standing = await request(app.getHttpServer())
      .get(`/tournaments/${tid}/standing`)
      .set(auth('a'))
      .expect(200);
    expect(standing.body.confirmedCount).toBe(2);
    expect(standing.body.pendingCount).toBe(1);
    expect(standing.body.winnerId).toBeNull();
    const detail = await request(app.getHttpServer())
      .get(`/tournaments/${tid}`)
      .set(auth('a'))
      .expect(200);
    expect(detail.body.status).toBe('ongoing');
    expect(detail.body.winnerId).toBeNull();
    // Badge untuk turnamen ini TIDAK terbit bagi siapa pun.
    for (const tag of ['a', 'b', 'c']) {
      const list = await request(app.getHttpServer())
        .get(`/users/${ids[tag]}/badges`)
        .expect(200);
      expect(
        (list.body.data as Array<{ refId: string }>).map((b) => b.refId),
      ).not.toContain(tid);
    }
  });

  it('guard badge: /badges/me tanpa token 401; user tak ada 404; UUID invalid 400', async () => {
    await request(app.getHttpServer()).get('/badges/me').expect(401);
    await request(app.getHttpServer())
      .get('/tournaments/00000000-0000-0000-0000-000000000000/standing')
      .set(auth('adm'))
      .expect(404);
    await request(app.getHttpServer())
      .get('/users/00000000-0000-0000-0000-000000000000/badges')
      .expect(404);
    await request(app.getHttpServer())
      .get('/users/bukan-uuid/badges')
      .expect(400);
  });
});
