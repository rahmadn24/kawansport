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

/** Hitungan manual ELO standar (mirror rumus EL-00, ditulis independen di test). */
function expectedEa(ra: number, rb: number): number {
  return 1 / (1 + Math.pow(10, (rb - ra) / 400));
}

describe('ELO foundation EL-00 (e2e)', () => {
  let app: INestApplication;
  let users: Repository<User>;
  let ratings: Repository<EloRating>;
  let history: Repository<EloHistory>;
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
  let adminToken: string;
  let match1v1 = '';

  const register = async (tag: string) => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `elo_${tag}_${ts}@example.com`, password })
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

    const a = await register('a');
    const b = await register('b');
    const c = await register('c');
    const d = await register('d');
    const adm = await register('adm');
    aId = a.user.id;
    bId = b.user.id;
    cId = c.user.id;
    dId = d.user.id;
    aToken = a.accessToken;
    bToken = b.accessToken;
    cToken = c.accessToken;
    dToken = d.accessToken;
    await users.update({ id: adm.user.id }, { role: 'super_admin' });
    adminToken = (
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: `elo_adm_${ts}@example.com`, password })
        .expect(200)
    ).body.accessToken as string;
  });

  afterAll(async () => {
    await app.close();
  });

  const authA = () => ({ Authorization: `Bearer ${aToken}` });
  const authB = () => ({ Authorization: `Bearer ${bToken}` });
  const authC = () => ({ Authorization: `Bearer ${cToken}` });
  const authD = () => ({ Authorization: `Bearer ${dToken}` });
  const authAdmin = () => ({ Authorization: `Bearer ${adminToken}` });

  const eloOf = async (userId: string, sport: string) =>
    ratings.findOne({ where: { userId, sport } });

  it('guard: tanpa token -> 401 (kecuali GET /users/:id/elo publik)', async () => {
    await request(app.getHttpServer())
      .post('/matches')
      .send({ sport: 'badminton', teamA: [aId], teamB: [bId], scoreA: 1, scoreB: 0 })
      .expect(401);
    await request(app.getHttpServer()).get('/matches/me').expect(401);
    await request(app.getHttpServer())
      .get('/matches/00000000-0000-0000-0000-000000000000')
      .expect(401);
    await request(app.getHttpServer()).get('/elo/me').expect(401);
    // Publik: tanpa token tetap 200.
    await request(app.getHttpServer()).get(`/users/${aId}/elo`).expect(200);
  });

  it('validasi create: overlap/duplikat/UUID invalid/skor negatif -> 400', async () => {
    const base = { sport: 'badminton', scoreA: 21, scoreB: 15 };
    // Overlap teamA/teamB.
    await request(app.getHttpServer())
      .post('/matches')
      .set(authA())
      .send({ ...base, teamA: [aId], teamB: [aId] })
      .expect(400);
    // Tim kosong.
    await request(app.getHttpServer())
      .post('/matches')
      .set(authA())
      .send({ ...base, teamA: [], teamB: [bId] })
      .expect(400);
    // UUID invalid.
    await request(app.getHttpServer())
      .post('/matches')
      .set(authA())
      .send({ ...base, teamA: ['bukan-uuid'], teamB: [bId] })
      .expect(400);
    // Skor negatif.
    await request(app.getHttpServer())
      .post('/matches')
      .set(authA())
      .send({ ...base, teamA: [aId], teamB: [bId], scoreA: -1 })
      .expect(400);
    // Pemain tak ada → 404.
    await request(app.getHttpServer())
      .post('/matches')
      .set(authA())
      .send({
        ...base,
        teamA: [aId],
        teamB: ['00000000-0000-0000-0000-000000000000'],
      })
      .expect(404);
  });

  it('1v1: create pending (creator auto-confirmer) → confirm pihak-1 saja tetap pending + rating 1000', async () => {
    const created = await request(app.getHttpServer())
      .post('/matches')
      .set(authA())
      .send({
        sport: 'badminton',
        teamA: [aId],
        teamB: [bId],
        scoreA: 21,
        scoreB: 15,
      })
      .expect(201);
    expect(created.body.status).toBe('pending');
    expect(created.body.confirmedBy).toEqual([aId]);
    const matchId = created.body.id as string;

    // Confirm pihak-1 saja (A sudah confirmer via create) → tetap pending.
    const still = await request(app.getHttpServer())
      .post(`/matches/${matchId}/confirm`)
      .set(authA())
      .expect(200);
    expect(still.body.status).toBe('pending');

    // Rating belum berubah: belum ada baris rating (implisit tetap 1000).
    expect(await eloOf(aId, 'badminton')).toBeNull();
    expect(await eloOf(bId, 'badminton')).toBeNull();
    const meA = await request(app.getHttpServer())
      .get('/elo/me')
      .set(authA())
      .expect(200);
    expect(meA.body.data).toEqual([]);

    // Lintas user (C bukan peserta) confirm → 403; detail → 403.
    await request(app.getHttpServer())
      .post(`/matches/${matchId}/confirm`)
      .set(authC())
      .expect(403);
    await request(app.getHttpServer())
      .get(`/matches/${matchId}`)
      .set(authC())
      .expect(403);
    // Admin boleh lihat detail.
    await request(app.getHttpServer())
      .get(`/matches/${matchId}`)
      .set(authAdmin())
      .expect(200);
    // Tak ada → 404.
    await request(app.getHttpServer())
      .get('/matches/00000000-0000-0000-0000-000000000000')
      .set(authA())
      .expect(404);

    // Simpan untuk test berikut.
    match1v1 = matchId;
  });

  it('1v1: confirm pihak-2 → confirmed + ELO benar (K=48 provisional: +24/-24 simetris)', async () => {
    const matchId = match1v1;
    const done = await request(app.getHttpServer())
      .post(`/matches/${matchId}/confirm`)
      .set(authB())
      .expect(200);
    expect(done.body.status).toBe('confirmed');
    expect(done.body.confirmedBy).toEqual(expect.arrayContaining([aId, bId]));

    // Hitungan manual: RA=RB=1000 → EA=0.5; K=48 provisional → ±24.
    const ea = expectedEa(1000, 1000);
    expect(ea).toBeCloseTo(0.5, 10);
    const delta = Math.round(48 * (1 - ea));
    expect(delta).toBe(24);

    const ra = await eloOf(aId, 'badminton');
    const rb = await eloOf(bId, 'badminton');
    expect(ra).not.toBeNull();
    expect(rb).not.toBeNull();
    expect(ra!.score).toBe(1000 + delta); // 1024
    expect(rb!.score).toBe(1000 - delta); // 976
    expect(ra!.matchesPlayed).toBe(1);
    expect(rb!.matchesPlayed).toBe(1);

    // History tercatat per pemain (before/after/delta/kFactor).
    const ha = await history.find({ where: { userId: aId, matchId } });
    const hb = await history.find({ where: { userId: bId, matchId } });
    expect(ha).toHaveLength(1);
    expect(hb).toHaveLength(1);
    expect(ha[0]).toMatchObject({
      before: 1000,
      after: 1024,
      delta: 24,
      kFactor: 48,
      sport: 'badminton',
    });
    expect(hb[0]).toMatchObject({
      before: 1000,
      after: 976,
      delta: -24,
      kFactor: 48,
    });

    // GET /elo/me + publik GET /users/:id/elo memuat provisional=true.
    const meA = await request(app.getHttpServer())
      .get('/elo/me')
      .set(authA())
      .expect(200);
    expect(meA.body.data).toEqual([
      { sport: 'badminton', score: 1024, matchesPlayed: 1, provisional: true },
    ]);
    const pubB = await request(app.getHttpServer())
      .get(`/users/${bId}/elo`)
      .expect(200);
    expect(pubB.body.data).toEqual([
      { sport: 'badminton', score: 976, matchesPlayed: 1, provisional: true },
    ]);
  });

  it('idempotent: confirm ulang → 200 tanpa efek ganda', async () => {
    const matchId = match1v1;
    const again = await request(app.getHttpServer())
      .post(`/matches/${matchId}/confirm`)
      .set(authA())
      .expect(200);
    expect(again.body.status).toBe('confirmed');
    expect((await eloOf(aId, 'badminton'))!.score).toBe(1024);
    expect((await eloOf(bId, 'badminton'))!.score).toBe(976);
    expect(
      await history.count({ where: { matchId } }),
    ).toBe(2);
  });

  it('2v2: rata-rata tim benar (hitung manual dari rating berjalan)', async () => {
    // Rating berjalan: A=1024 (1 match), B=976 (1 match), C/D=1000 (fresh).
    const created = await request(app.getHttpServer())
      .post('/matches')
      .set(authA())
      .send({
        sport: 'badminton',
        teamA: [aId, bId],
        teamB: [cId, dId],
        scoreA: 21,
        scoreB: 19,
      })
      .expect(201);
    const matchId = created.body.id as string;
    expect(created.body.status).toBe('pending');

    // Satu pihak saja (A) → tetap pending.
    await request(app.getHttpServer())
      .post(`/matches/${matchId}/confirm`)
      .set(authB())
      .expect(200)
      .then((res) => expect(res.body.status).toBe('pending'));

    // Pihak kedua (C) → confirmed.
    const done = await request(app.getHttpServer())
      .post(`/matches/${matchId}/confirm`)
      .set(authC())
      .expect(200);
    expect(done.body.status).toBe('confirmed');

    // Hitungan manual: avgA=(1024+976)/2=1000, avgB=(1000+1000)/2=1000.
    const avgA = (1024 + 976) / 2;
    const avgB = (1000 + 1000) / 2;
    expect(avgA).toBe(1000);
    const expA = Math.round(48 * (1 - expectedEa(1024, avgB)));
    const expB = Math.round(48 * (1 - expectedEa(976, avgB)));
    const expC = Math.round(48 * (0 - expectedEa(1000, avgA)));
    const expD = Math.round(48 * (0 - expectedEa(1000, avgA)));

    expect((await eloOf(aId, 'badminton'))!.score).toBe(1024 + expA);
    expect((await eloOf(bId, 'badminton'))!.score).toBe(976 + expB);
    expect((await eloOf(cId, 'badminton'))!.score).toBe(1000 + expC);
    expect((await eloOf(dId, 'badminton'))!.score).toBe(1000 + expD);
    // Simetri tim: total delta teamA == -(total delta teamB).
    expect(expA + expB).toBe(-(expC + expD));
    expect(await history.count({ where: { matchId } })).toBe(4);
  });

  it('GET /matches/me + filter ?status=', async () => {
    const mine = await request(app.getHttpServer())
      .get('/matches/me')
      .set(authA())
      .expect(200);
    const ids = (mine.body.data as Array<{ id: string }>).map((m) => m.id);
    expect(ids.length).toBeGreaterThanOrEqual(2);

    const confirmed = await request(app.getHttpServer())
      .get('/matches/me')
      .set(authA())
      .query({ status: 'confirmed' })
      .expect(200);
    expect(
      (confirmed.body.data as Array<{ status: string }>).every(
        (m) => m.status === 'confirmed',
      ),
    ).toBe(true);

    const pendingC = await request(app.getHttpServer())
      .get('/matches/me')
      .set(authC())
      .query({ status: 'pending' })
      .expect(200);
    expect(
      (pendingC.body.data as Array<{ status: string }>).every(
        (m) => m.status === 'pending',
      ),
    ).toBe(true);
  });

  it('cancel: creator OK; lintas-user 403; non-pending 409', async () => {
    const created = await request(app.getHttpServer())
      .post('/matches')
      .set(authC())
      .send({
        sport: 'futsal',
        teamA: [cId],
        teamB: [dId],
        scoreA: 2,
        scoreB: 1,
      })
      .expect(201);
    const matchId = created.body.id as string;

    // Lintas user (B) cancel → 403.
    await request(app.getHttpServer())
      .post(`/matches/${matchId}/cancel`)
      .set(authB())
      .expect(403);
    // Creator cancel → 200 cancelled.
    const cancelled = await request(app.getHttpServer())
      .post(`/matches/${matchId}/cancel`)
      .set(authC())
      .expect(200);
    expect(cancelled.body.status).toBe('cancelled');
    // Cancel ulang → 409; confirm atas cancelled → 409.
    await request(app.getHttpServer())
      .post(`/matches/${matchId}/cancel`)
      .set(authC())
      .expect(409);
    await request(app.getHttpServer())
      .post(`/matches/${matchId}/confirm`)
      .set(authC())
      .expect(409);
  });

  it('dispute: terlibat → disputed + freeze (tanpa ELO)', async () => {
    const created = await request(app.getHttpServer())
      .post('/matches')
      .set(authD())
      .send({
        sport: 'futsal',
        teamA: [cId],
        teamB: [dId],
        scoreA: 3,
        scoreB: 3,
      })
      .expect(201);
    const matchId = created.body.id as string;

    // Lintas user (A) dispute → 403.
    await request(app.getHttpServer())
      .post(`/matches/${matchId}/dispute`)
      .set(authA())
      .expect(403);
    // Terlibat dispute → disputed; rating futsal tak tersentuh.
    const disputed = await request(app.getHttpServer())
      .post(`/matches/${matchId}/dispute`)
      .set(authD())
      .expect(200);
    expect(disputed.body.status).toBe('disputed');
    expect(await eloOf(cId, 'futsal')).toBeNull();
    expect(await eloOf(dId, 'futsal')).toBeNull();
    // Confirm atas disputed → 409.
    await request(app.getHttpServer())
      .post(`/matches/${matchId}/confirm`)
      .set(authC())
      .expect(409);
  });
});
