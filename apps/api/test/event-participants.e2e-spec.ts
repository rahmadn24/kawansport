process.env.DB_DRIVER = 'sqljs';
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '7d';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Event participants (e2e) SM-05', () => {
  let app: INestApplication;
  const ts = Date.now();
  const hostEmail = `sm05host_${ts}@example.com`;
  const password = 'Password123!';
  let hostToken: string;
  let eventId: string;

  const payload = {
    sport: 'Futsal',
    title: 'SM-05 Join Race',
    description: 'Uji join/leave transaksional',
    datetime: '2026-10-04T09:00:00+07:00',
    lat: -6.2,
    lng: 106.8,
    capacity: 5,
  };

  async function register(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, displayName: email.split('@')[0] })
      .expect(201);
    return res.body.accessToken as string;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    hostToken = await register(hostEmail);
    const created = await request(app.getHttpServer())
      .post('/events')
      .set({ Authorization: `Bearer ${hostToken}` })
      .send(payload)
      .expect(201);
    eventId = created.body.id;
  });

  it('create: host otomatis peserta #1 (count=1, isJoined host=true)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/events/${eventId}`)
      .set({ Authorization: `Bearer ${hostToken}` })
      .expect(200);
    expect(res.body.participantsCount).toBe(1);
    expect(res.body.isJoined).toBe(true);

    const parts = await request(app.getHttpServer())
      .get(`/events/${eventId}/participants`)
      .set({ Authorization: `Bearer ${hostToken}` })
      .expect(200);
    expect(parts.body.meta.total).toBe(1);
    expect(parts.body.data[0].email).toBe(hostEmail);
  });

  it('join/leave happy path + isJoined real per user', async () => {
    const token = await register(`sm05a_${ts}@example.com`);

    const before = await request(app.getHttpServer())
      .get(`/events/${eventId}`)
      .set({ Authorization: `Bearer ${token}` })
      .expect(200);
    expect(before.body.isJoined).toBe(false);

    const joined = await request(app.getHttpServer())
      .post(`/events/${eventId}/join`)
      .set({ Authorization: `Bearer ${token}` })
      .expect(201);
    expect(joined.body.isJoined).toBe(true);
    expect(joined.body.participantsCount).toBe(2);

    const after = await request(app.getHttpServer())
      .get(`/events/${eventId}`)
      .set({ Authorization: `Bearer ${token}` })
      .expect(200);
    expect(after.body.isJoined).toBe(true);

    const left = await request(app.getHttpServer())
      .post(`/events/${eventId}/leave`)
      .set({ Authorization: `Bearer ${token}` })
      .expect(200);
    expect(left.body.isJoined).toBe(false);
    expect(left.body.participantsCount).toBe(1);
  });

  it('double-join -> 409, leave tanpa join -> 404', async () => {
    const token = await register(`sm05b_${ts}@example.com`);
    await request(app.getHttpServer())
      .post(`/events/${eventId}/join`)
      .set({ Authorization: `Bearer ${token}` })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/events/${eventId}/join`)
      .set({ Authorization: `Bearer ${token}` })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/events/${eventId}/leave`)
      .set({ Authorization: `Bearer ${token}` })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/events/${eventId}/leave`)
      .set({ Authorization: `Bearer ${token}` })
      .expect(404);
  });

  it('event penuh -> 409 + status full, leave membuka slot lagi', async () => {
    const small = await request(app.getHttpServer())
      .post('/events')
      .set({ Authorization: `Bearer ${hostToken}` })
      .send({ ...payload, title: 'SM-05 Full Check', capacity: 2 })
      .expect(201);
    const smallId = small.body.id as string;
    expect(small.body.participantsCount).toBe(1);

    const t1 = await register(`sm05c_${ts}@example.com`);
    const full = await request(app.getHttpServer())
      .post(`/events/${smallId}/join`)
      .set({ Authorization: `Bearer ${t1}` })
      .expect(201);
    expect(full.body.participantsCount).toBe(2);
    expect(full.body.status).toBe('full');

    const t2 = await register(`sm05d_${ts}@example.com`);
    await request(app.getHttpServer())
      .post(`/events/${smallId}/join`)
      .set({ Authorization: `Bearer ${t2}` })
      .expect(409);

    await request(app.getHttpServer())
      .post(`/events/${smallId}/leave`)
      .set({ Authorization: `Bearer ${t1}` })
      .expect(200);
    const reopened = await request(app.getHttpServer())
      .get(`/events/${smallId}`)
      .set({ Authorization: `Bearer ${hostToken}` })
      .expect(200);
    expect(reopened.body.status).toBe('open');
    expect(reopened.body.participantsCount).toBe(1);
  });

  it('join/leave/participants tanpa token -> 401; event tak ada -> 404', async () => {
    const missing = '00000000-0000-4000-8000-000000000000';
    await request(app.getHttpServer()).post(`/events/${eventId}/join`).expect(401);
    await request(app.getHttpServer()).post(`/events/${eventId}/leave`).expect(401);
    await request(app.getHttpServer()).get(`/events/${eventId}/participants`).expect(401);
    await request(app.getHttpServer())
      .post(`/events/${missing}/join`)
      .set({ Authorization: `Bearer ${hostToken}` })
      .expect(404);
    await request(app.getHttpServer())
      .get(`/events/${missing}/participants`)
      .set({ Authorization: `Bearer ${hostToken}` })
      .expect(404);
  });

  it('race: 20 parallel join ke capacity 5 -> hanya sisa slot yang sukses', async () => {
    // Batas harness: server supertest in-process hanya melayani ~3 koneksi
    // bersamaan (terbukti juga di GET /health tanpa DB), jadi 20-way paralel
    // dieksekusi di level service (jalur logika transaksional yang sama yang
    // dipakai controller), lalu hasil akhir diverifikasi lewat HTTP.
    const { EventsService } = await import('../src/events/events.service');
    const { UsersService } = await import('../src/users/users.service');
    const eventsService = app.get(EventsService);
    const usersService = app.get(UsersService);

    const race = await request(app.getHttpServer())
      .post('/events')
      .set({ Authorization: `Bearer ${hostToken}` })
      .send({ ...payload, title: 'SM-05 Race', capacity: 5 })
      .expect(201);
    const raceId = race.body.id as string;
    // Host menempati 1 dari 5 slot -> tersisa 4 kursi untuk 20 pembalap.
    expect(race.body.participantsCount).toBe(1);

    const emails: string[] = [];
    for (let i = 0; i < 20; i++) {
      const email = `sm05race${i}_${ts}@example.com`;
      await register(email);
      emails.push(email);
    }
    const ids = await Promise.all(
      emails.map(async (email) => (await usersService.findByEmail(email))!.id as string),
    );

    const settled = await Promise.allSettled(
      ids.map((id) => eventsService.join(raceId, id)),
    );
    const ok = settled.filter((s) => s.status === 'fulfilled');
    const conflict = settled.filter(
      (s) => s.status === 'rejected' && (s as PromiseRejectedResult).reason?.status === 409,
    );
    expect(ok.length).toBe(4);
    expect(conflict.length).toBe(16);

    const detail = await request(app.getHttpServer())
      .get(`/events/${raceId}`)
      .set({ Authorization: `Bearer ${hostToken}` })
      .expect(200);
    expect(detail.body.participantsCount).toBe(5);
    expect(detail.body.status).toBe('full');

    const parts = await request(app.getHttpServer())
      .get(`/events/${raceId}/participants`)
      .set({ Authorization: `Bearer ${hostToken}` })
      .expect(200);
    expect(parts.body.meta.total).toBe(5);
    expect(parts.body.data.length).toBe(5);
    const partEmails = parts.body.data.map((p: { email: string }) => p.email);
    expect(new Set(partEmails).size).toBe(5);
  });

  it('3 parallel join via HTTP (batas harness) semua sukses', async () => {
    const ev = await request(app.getHttpServer())
      .post('/events')
      .set({ Authorization: `Bearer ${hostToken}` })
      .send({ ...payload, title: 'SM-05 HTTP parallel', capacity: 10 })
      .expect(201);
    const tokens = await Promise.all([
      register(`sm05p0_${ts}@example.com`),
      register(`sm05p1_${ts}@example.com`),
      register(`sm05p2_${ts}@example.com`),
    ]);
    const results = await Promise.all(
      tokens.map((t) =>
        request(app.getHttpServer())
          .post(`/events/${ev.body.id}/join`)
          .set({ Authorization: `Bearer ${t}` }),
      ),
    );
    expect(results.map((r) => r.status)).toEqual([201, 201, 201]);
    const detail = await request(app.getHttpServer())
      .get(`/events/${ev.body.id}`)
      .set({ Authorization: `Bearer ${hostToken}` })
      .expect(200);
    expect(detail.body.participantsCount).toBe(4);
  });

  afterAll(async () => {
    await app.close();
  });
});
