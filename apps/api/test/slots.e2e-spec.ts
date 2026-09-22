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
import { SlotClaim } from '../src/venues/slot-claim.entity';

describe('Slots BK-02 (e2e)', () => {
  let app: INestApplication;
  let users: Repository<User>;
  let claims: Repository<SlotClaim>;
  const ts = Date.now();
  const password = 'Password123!';

  let ownerToken: string;
  let ownerId: string;
  let userToken: string;
  let userId: string;
  let courtId: string;
  let closedCourtId: string;

  const DATE = '2030-05-15';
  const ALL_DAYS_OPEN = {
    mon: ['08:00-10:00'],
    tue: ['08:00-10:00'],
    wed: ['08:00-10:00'],
    thu: ['08:00-10:00'],
    fri: ['08:00-10:00'],
    sat: ['08:00-10:00'],
    sun: ['08:00-10:00'],
  };

  const authOwner = () => ({ Authorization: `Bearer ${ownerToken}` });
  const authUser = () => ({ Authorization: `Bearer ${userToken}` });

  /** Tanggal YYYY-MM-DD untuk weekday target (0=Sun..6=Sat). */
  function dateForWeekday(target: number): string {
    const base = new Date(Date.UTC(2030, 4, 15)); // 2030-05-15
    const diff = (target - base.getUTCDay() + 7) % 7;
    const t = new Date(base.getTime() + diff * 86_400_000);
    return t.toISOString().slice(0, 10);
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    users = app.get<Repository<User>>(getRepositoryToken(User));
    claims = app.get<Repository<SlotClaim>>(getRepositoryToken(SlotClaim));

    const regOwner = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `bk02_owner_${ts}@example.com`, password })
      .expect(201);
    ownerId = regOwner.body.user.id as string;
    await users.update({ id: ownerId }, { role: 'venue_owner' });
    ownerToken = (
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: `bk02_owner_${ts}@example.com`, password })
        .expect(200)
    ).body.accessToken;

    const regUser = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `bk02_user_${ts}@example.com`, password })
      .expect(201);
    userId = regUser.body.user.id as string;
    userToken = regUser.body.accessToken as string;

    const venue = await request(app.getHttpServer())
      .post('/venues')
      .set(authOwner())
      .send({
        name: 'GOR BK02',
        address: 'Jl. Slot No. 2',
        lat: -6.2,
        lng: 106.8,
        sports: ['Futsal'],
      })
      .expect(201);

    const court = await request(app.getHttpServer())
      .post(`/venues/${venue.body.id}/courts`)
      .set(authOwner())
      .send({
        sport: 'Futsal',
        name: 'Lapangan Slot',
        pricePerHour: 100000,
        openHours: ALL_DAYS_OPEN,
      })
      .expect(201);
    courtId = court.body.id;

    const closed = await request(app.getHttpServer())
      .post(`/venues/${venue.body.id}/courts`)
      .set(authOwner())
      .send({
        sport: 'Futsal',
        name: 'Lapangan Senin Saja',
        pricePerHour: 100000,
        openHours: { mon: ['08:00-09:00'] },
      })
      .expect(201);
    closedCourtId = closed.body.id;
  });

  it('availability tanpa token -> 401', async () => {
    await request(app.getHttpServer())
      .get(`/courts/${courtId}/availability`)
      .query({ date: DATE })
      .expect(401);
  });

  it('availability sesuai open_hours: 08:00-10:00 -> 2 slot free', async () => {
    const res = await request(app.getHttpServer())
      .get(`/courts/${courtId}/availability`)
      .set(authUser())
      .query({ date: DATE })
      .expect(200);
    expect(res.body.courtId).toBe(courtId);
    expect(res.body.date).toBe(DATE);
    expect(res.body.slots).toHaveLength(2);
    expect(res.body.slots[0]).toMatchObject({
      start: '08:00',
      end: '09:00',
      startMinute: 480,
      endMinute: 540,
      status: 'free',
    });
    expect(res.body.slots[1]).toMatchObject({
      start: '09:00',
      end: '10:00',
      status: 'free',
    });
  });

  it('hari tanpa open_hours -> slots kosong', async () => {
    const tuesday = dateForWeekday(2);
    expect(tuesday).not.toBe(dateForWeekday(1));
    const res = await request(app.getHttpServer())
      .get(`/courts/${closedCourtId}/availability`)
      .set(authUser())
      .query({ date: tuesday })
      .expect(200);
    expect(res.body.slots).toEqual([]);
  });

  it('availability validasi: tanggal rusak -> 400', async () => {
    await request(app.getHttpServer())
      .get(`/courts/${courtId}/availability`)
      .set(authUser())
      .query({ date: 'not-a-date' })
      .expect(400);
    await request(app.getHttpServer())
      .get(`/courts/${courtId}/availability`)
      .set(authUser())
      .query({ date: '2030-02-30' })
      .expect(400);
  });

  it('hold sukses -> availability terbaca held; hold ganda -> 409', async () => {
    const hold = await request(app.getHttpServer())
      .post(`/courts/${courtId}/hold`)
      .set(authUser())
      .send({ date: DATE, start: '08:00' })
      .expect(201);
    expect(hold.body.status).toBe('held');
    expect(hold.body.startMinute).toBe(480);
    expect(new Date(hold.body.expiresAt).getTime()).toBeGreaterThan(Date.now());
    const holdId = hold.body.id as string;

    const avail = await request(app.getHttpServer())
      .get(`/courts/${courtId}/availability`)
      .set(authUser())
      .query({ date: DATE })
      .expect(200);
    const slot = (avail.body.slots as Array<{ start: string; status: string }>).find(
      (s) => s.start === '08:00',
    );
    expect(slot?.status).toBe('held');

    await request(app.getHttpServer())
      .post(`/courts/${courtId}/hold`)
      .set(authOwner())
      .send({ date: DATE, startMinute: 480 })
      .expect(409);

    await request(app.getHttpServer())
      .post(`/holds/${holdId}/release`)
      .set(authUser())
      .expect(200);
  });

  it('hold di luar open_hours -> 400', async () => {
    await request(app.getHttpServer())
      .post(`/courts/${courtId}/hold`)
      .set(authUser())
      .send({ date: DATE, start: '10:00' })
      .expect(400);
  });

  it('release lalu slot free lagi; release orang lain -> 403', async () => {
    const hold = await request(app.getHttpServer())
      .post(`/courts/${courtId}/hold`)
      .set(authUser())
      .send({ date: DATE, start: '09:00' })
      .expect(201);

    // owner venue boleh melepas (dipakai juga untuk cleanup kasus ini bila 403 berubah).
    await request(app.getHttpServer())
      .post(`/holds/${hold.body.id}/release`)
      .set(authOwner())
      .expect(200);

    const avail = await request(app.getHttpServer())
      .get(`/courts/${courtId}/availability`)
      .set(authUser())
      .query({ date: DATE })
      .expect(200);
    const slot = (avail.body.slots as Array<{ start: string; status: string }>).find(
      (s) => s.start === '09:00',
    );
    expect(slot?.status).toBe('free');
  });

  it('release hold orang lain oleh user biasa -> 403', async () => {
    const hold = await request(app.getHttpServer())
      .post(`/courts/${courtId}/hold`)
      .set(authOwner())
      .send({ date: DATE, start: '09:00' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/holds/${hold.body.id}/release`)
      .set(authUser())
      .expect(403);

    await request(app.getHttpServer())
      .post(`/holds/${hold.body.id}/release`)
      .set(authOwner())
      .expect(200);
  });

  it('confirmed (booking BK-03) terbaca booked dan tidak bisa di-hold', async () => {
    // Bersihkan baris slot ini dulu (unique court,date,start — dipakai ulang
    // antar-hold, jadi hapus agar bisa disiapkan sebagai confirmed).
    await claims.delete({ courtId, date: DATE, startMinute: 540 });
    const row = await claims.save(
      claims.create({
        courtId,
        date: DATE,
        startMinute: 540,
        endMinute: 600,
        status: 'confirmed',
        holderId: '00000000-0000-0000-0000-000000000000',
        expiresAt: null,
      }),
    );

    const avail = await request(app.getHttpServer())
      .get(`/courts/${courtId}/availability`)
      .set(authUser())
      .query({ date: DATE })
      .expect(200);
    const slot = (avail.body.slots as Array<{ start: string; status: string }>).find(
      (s) => s.start === '09:00',
    );
    expect(slot?.status).toBe('booked');

    await request(app.getHttpServer())
      .post(`/courts/${courtId}/hold`)
      .set(authUser())
      .send({ date: DATE, start: '09:00' })
      .expect(409);

    await claims.remove(row);
  });

  it('hold kedaluwarsa otomatis free + bisa diklaim ulang', async () => {
    const hold = await request(app.getHttpServer())
      .post(`/courts/${courtId}/hold`)
      .set(authUser())
      .send({ date: DATE, start: '08:00' })
      .expect(201);

    await claims.update(
      { id: hold.body.id },
      { expiresAt: new Date(Date.now() - 60_000) },
    );

    const avail = await request(app.getHttpServer())
      .get(`/courts/${courtId}/availability`)
      .set(authUser())
      .query({ date: DATE })
      .expect(200);
    const slot = (avail.body.slots as Array<{ start: string; status: string }>).find(
      (s) => s.start === '08:00',
    );
    expect(slot?.status).toBe('free');

    const rehold = await request(app.getHttpServer())
      .post(`/courts/${courtId}/hold`)
      .set(authOwner())
      .send({ date: DATE, start: '08:00' })
      .expect(201);
    expect(rehold.body.status).toBe('held');

    await request(app.getHttpServer())
      .post(`/holds/${rehold.body.id}/release`)
      .set(authOwner())
      .expect(200);
  });

  it('RACE: 20 paralel hold slot sama -> tepat 1 sukses', async () => {
    // Batas harness: server supertest in-process hanya melayani ~3 koneksi
    // bersamaan (lihat SM-05), jadi 20-way paralel dieksekusi di level
    // service (jalur transaksional yang sama yang dipakai controller),
    // lalu hasil akhir diverifikasi lewat HTTP.
    const { SlotsService } = await import('../src/venues/slots.service');
    const slotsService = app.get(SlotsService);

    await claims.delete({ courtId, date: DATE, startMinute: 480 });

    const actors = Array.from({ length: 20 }, (_, i) =>
      i % 2 === 0
        ? { id: userId, role: 'user' as const }
        : { id: ownerId, role: 'venue_owner' as const },
    );
    const settled = await Promise.allSettled(
      actors.map((actor) =>
        slotsService.hold(courtId, actor, {
          date: DATE,
          start: '08:00',
        } as never),
      ),
    );
    const ok = settled.filter((s) => s.status === 'fulfilled');
    const conflict = settled.filter(
      (s) =>
        s.status === 'rejected' &&
        (s as PromiseRejectedResult).reason?.status === 409,
    );
    expect(ok).toHaveLength(1);
    expect(conflict).toHaveLength(19);

    // Verifikasi via HTTP: slot terbaca held.
    const avail = await request(app.getHttpServer())
      .get(`/courts/${courtId}/availability`)
      .set(authUser())
      .query({ date: DATE })
      .expect(200);
    const slot = (avail.body.slots as Array<{ start: string; status: string }>).find(
      (s) => s.start === '08:00',
    );
    expect(slot?.status).toBe('held');

    // Cleanup agar suite lain stabil.
    const winner = (ok[0] as PromiseFulfilledResult<{ id: string }>).value;
    const winnerIsUser = settled.findIndex((s) => s === ok[0]) % 2 === 0;
    await request(app.getHttpServer())
      .post(`/holds/${winner.id}/release`)
      .set(winnerIsUser ? authUser() : authOwner())
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });
});
