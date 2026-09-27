process.env.DB_DRIVER = 'sqljs';
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '7d';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Booking } from '../src/bookings/booking.entity';
import { Court } from '../src/venues/court.entity';
import { Venue } from '../src/venues/venue.entity';

/**
 * ST-07 (Trello #67): verified badge + stats real + circle.
 * EL-05 menutup TODO-EL: stats kini memuat rekor match REAL
 * (`totalMatches/wins/losses/draws/winRate` dari match `confirmed`);
 * circle memuat lawan match `confirmed`; badge/achievement tetap di
 * endpoint badge (`GET /users/:id/badges`) — keputusan final.
 */
describe('Users ST-07 terbatas (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  const stamp = Date.now();
  const password = 'Password123!';

  const emails = {
    host: `st07_host_${stamp}@example.com`,
    player: `st07_player_${stamp}@example.com`,
    chatOnly: `st07_chat_${stamp}@example.com`,
    admin: `st07_admin_${stamp}@example.com`,
  };
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};
  let eventId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    ds = app.get(DataSource);

    for (const [key, email] of Object.entries(emails)) {
      const reg = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password, displayName: `ST07 ${key}` })
        .expect(201);
      tokens[key] = reg.body.accessToken;
      ids[key] = reg.body.user.id;
    }
    // Promosikan admin langsung di DB; RolesGuard baca ulang role dari DB
    // untuk route super_admin (SEC-01) sehingga token lama tetap sah.
    await ds.query('UPDATE users SET role = ? WHERE id = ?', [
      'super_admin',
      ids.admin,
    ]);

    // Host buat event gratis kapasitas 10; player join.
    const ev = await request(app.getHttpServer())
      .post('/events')
      .set({ Authorization: `Bearer ${tokens.host}` })
      .send({
        sport: 'Futsal',
        title: 'ST07 Mabar',
        datetime: '2026-11-01T09:00:00+07:00',
        lat: -6.2,
        lng: 106.8,
        capacity: 10,
      })
      .expect(201);
    eventId = ev.body.id;
    await request(app.getHttpServer())
      .post(`/events/${eventId}/join`)
      .set({ Authorization: `Bearer ${tokens.player}` })
      .expect(201);

    // Chat host<->chatOnly (tanpa event bersama) + host<->player.
    await request(app.getHttpServer())
      .post('/conversations')
      .set({ Authorization: `Bearer ${tokens.host}` })
      .send({ partnerId: ids.chatOnly })
      .expect(201);
    await request(app.getHttpServer())
      .post('/conversations')
      .set({ Authorization: `Bearer ${tokens.host}` })
      .send({ partnerId: ids.player })
      .expect(201);

    // Satu booking PAID via insert langsung (venue+court minimal) agar
    // stats totalBookingsPaid + sports dari court teruji tanpa
    // menggantungkan flow Midtrans penuh.
    const venueRepo = ds.getRepository(Venue);
    const venue = await venueRepo.save(
      venueRepo.create({
        name: 'ST07 Venue',
        address: 'Jl. ST07 No. 7',
        lat: -6.2,
        lng: 106.8,
        ownerId: ids.host,
        sports: ['Futsal'],
      }),
    );
    const courtRepo = ds.getRepository(Court);
    const court = await courtRepo.save(
      courtRepo.create({
        venueId: venue.id,
        sport: 'Basket',
        name: 'Court ST07',
        pricePerHour: 50000,
      }),
    );
    const bookingRepo = ds.getRepository(Booking);
    await bookingRepo.save(
      bookingRepo.create({
        userId: ids.player,
        courtId: court.id,
        date: '2026-11-02',
        startMinute: 480,
        endMinute: 540,
        status: 'paid',
        paymentRef: `ST07-${stamp}`,
        amount: 50000,
        subtotal: 50000,
      }),
    );
  });

  const srv = () => request(app.getHttpServer());

  it('GET /me memuat verified:false untuk user baru', async () => {
    const res = await srv()
      .get('/me')
      .set({ Authorization: `Bearer ${tokens.player}` })
      .expect(200);
    expect(res.body.verified).toBe(false);
  });

  it('POST /users/:id/verify tanpa token -> 401; user biasa -> 403', async () => {
    await srv().post(`/users/${ids.player}/verify`).expect(401);
    await srv()
      .post(`/users/${ids.player}/verify`)
      .set({ Authorization: `Bearer ${tokens.host}` })
      .expect(403);
  });

  it('POST /users/:id/verify super_admin -> 200 + idempotent + 404 tak dikenal', async () => {
    const admin = { Authorization: `Bearer ${tokens.admin}` };
    const first = await srv()
      .post(`/users/${ids.player}/verify`)
      .set(admin)
      .expect(200);
    expect(first.body.verified).toBe(true);
    const second = await srv()
      .post(`/users/${ids.player}/verify`)
      .set(admin)
      .expect(200);
    expect(second.body.verified).toBe(true);
    await srv()
      .post('/users/00000000-0000-4000-8000-000000000000/verify')
      .set(admin)
      .expect(404);
    await srv().post('/users/bukan-uuid/verify').set(admin).expect(400);
  });

  it('badge verified tampil di /me dan /users/search', async () => {
    const me = await srv()
      .get('/me')
      .set({ Authorization: `Bearer ${tokens.player}` })
      .expect(200);
    expect(me.body.verified).toBe(true);

    const search = await srv()
      .get('/users/search')
      .query({ sport: 'Futsal' })
      .set({ Authorization: `Bearer ${tokens.host}` })
      .expect(200);
    // Host tanpa sports Futsal di profil... cari tanpa filter sport agar
    // player (verified) pasti ikut hasil.
    const all = await srv()
      .get('/users/search')
      .set({ Authorization: `Bearer ${tokens.chatOnly}` })
      .expect(200);
    const found = (all.body.data as Array<{ id: string; verified: boolean }>).find(
      (u) => u.id === ids.player,
    );
    expect(found).toBeDefined();
    expect(found?.verified).toBe(true);
    expect(search.status).toBe(200);
  });

  it('GET /users/:id/stats dari data REAL (host/join/paid/sports)', async () => {
    const hostStats = await srv()
      .get(`/users/${ids.host}/stats`)
      .set({ Authorization: `Bearer ${tokens.player}` })
      .expect(200);
    // Host = peserta #1 otomatis: hosted 1 + joined 1 (milik sendiri).
    expect(hostStats.body.totalEventsHosted).toBe(1);
    expect(hostStats.body.totalEventsJoined).toBe(1);
    expect(hostStats.body.totalBookingsPaid).toBe(0);
    expect(hostStats.body.sports).toContain('Futsal');
    expect(hostStats.body.sportsCount).toBe(hostStats.body.sports.length);
    // EL-05: rekor match REAL (belum ada match → nol + winRate null).
    expect(hostStats.body.totalMatches).toBe(0);
    expect(hostStats.body.wins).toBe(0);
    expect(hostStats.body.losses).toBe(0);
    expect(hostStats.body.draws).toBe(0);
    expect(hostStats.body.winRate).toBeNull();
    expect(hostStats.body.user.verified).toBe(false);

    const playerStats = await srv()
      .get(`/users/${ids.player}/stats`)
      .set({ Authorization: `Bearer ${tokens.host}` })
      .expect(200);
    expect(playerStats.body.totalEventsHosted).toBe(0);
    expect(playerStats.body.totalEventsJoined).toBe(1);
    expect(playerStats.body.totalBookingsPaid).toBe(1);
    // Sports gabungan: event Futsal (join) + court Basket (booking paid).
    expect(playerStats.body.sports).toEqual(
      expect.arrayContaining(['Futsal', 'Basket']),
    );
    expect(playerStats.body.user.verified).toBe(true);
  });

  it('GET /users/:id/stats user baru = nol + tanpa token -> 401 + 404 tak dikenal', async () => {
    const fresh = await srv()
      .get(`/users/${ids.chatOnly}/stats`)
      .set({ Authorization: `Bearer ${tokens.host}` })
      .expect(200);
    expect(fresh.body).toMatchObject({
      totalEventsHosted: 0,
      totalEventsJoined: 0,
      totalBookingsPaid: 0,
      sportsCount: 0,
      sports: [],
    });
    await srv().get(`/users/${ids.host}/stats`).expect(401);
    await srv()
      .get('/users/00000000-0000-4000-8000-000000000000/stats')
      .set({ Authorization: `Bearer ${tokens.host}` })
      .expect(404);
  });

  it('GET /users/me/circle = partner chat + co-participants, dedupe', async () => {
    const res = await srv()
      .get('/users/me/circle')
      .set({ Authorization: `Bearer ${tokens.host}` })
      .expect(200);
    const gotIds = (res.body.data as Array<{ id: string }>).map((m) => m.id);
    // player: 1 event bersama + 1 conversation = tepat 1 baris (dedupe).
    expect(gotIds.filter((id) => id === ids.player)).toHaveLength(1);
    // chatOnly: hanya conversation, tetap masuk circle.
    expect(gotIds).toContain(ids.chatOnly);
    // Diri sendiri tidak masuk; admin (tanpa relasi) tidak masuk.
    expect(gotIds).not.toContain(ids.host);
    expect(gotIds).not.toContain(ids.admin);
    expect(res.body.meta.total).toBe(res.body.data.length);
    // Shape anggota: ringkasan publik + verified.
    expect(res.body.data[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        email: expect.any(String),
        verified: expect.any(Boolean),
        sports: expect.any(Array),
      }),
    );
  });

  it('GET /users/me/circle user tanpa relasi = kosong + tanpa token -> 401', async () => {
    const res = await srv()
      .get('/users/me/circle')
      .set({ Authorization: `Bearer ${tokens.admin}` })
      .expect(200);
    expect(res.body).toEqual({ data: [], meta: { total: 0 } });
    await srv().get('/users/me/circle').expect(401);
  });

  afterAll(async () => {
    await app.close();
  });
});
