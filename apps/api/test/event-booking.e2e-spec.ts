process.env.DB_DRIVER = 'sqljs';
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '7d';
// Paksa mode stub Midtrans (tanpa network/key).
process.env.MIDTRANS_SERVER_KEY = '';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { User } from '../src/users/user.entity';

describe('Event->Booking BK-04 (e2e)', () => {
  let app: INestApplication;
  let users: Repository<User>;
  const ts = Date.now();
  const password = 'Password123!';

  let ownerToken: string;
  let hostToken: string;
  let playerToken: string;
  let outsiderToken: string;
  let courtId: string;
  let eventId: string;

  // 2030-06-17 = Rabu; pakai Z agar hari-UTC deterministik (aturan same-day BK-04).
  const EVENT_DATETIME = '2030-06-17T09:00:00Z';
  const EVENT_DAY = '2030-06-17';
  const OTHER_DAY = '2030-06-18';
  const ALL_DAYS_OPEN = {
    mon: ['08:00-11:00'],
    tue: ['08:00-11:00'],
    wed: ['08:00-11:00'],
    thu: ['08:00-11:00'],
    fri: ['08:00-11:00'],
    sat: ['08:00-11:00'],
    sun: ['08:00-11:00'],
  };

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  async function register(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password })
      .expect(201);
    return res.body.accessToken as string;
  }

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

    ownerToken = await register(`bk04_owner_${ts}@example.com`);
    const ownerId = (
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: `bk04_owner_${ts}@example.com`, password })
        .expect(200)
    ).body.user.id as string;
    await users.update({ id: ownerId }, { role: 'venue_owner' });
    ownerToken = (
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: `bk04_owner_${ts}@example.com`, password })
        .expect(200)
    ).body.accessToken;

    hostToken = await register(`bk04_host_${ts}@example.com`);
    playerToken = await register(`bk04_player_${ts}@example.com`);
    outsiderToken = await register(`bk04_outsider_${ts}@example.com`);

    const venue = await request(app.getHttpServer())
      .post('/venues')
      .set(auth(ownerToken))
      .send({
        name: 'GOR BK04',
        address: 'Jl. Event No. 4',
        lat: -6.2,
        lng: 106.8,
        sports: ['Futsal'],
      })
      .expect(201);

    const court = await request(app.getHttpServer())
      .post(`/venues/${venue.body.id}/courts`)
      .set(auth(ownerToken))
      .send({
        sport: 'Futsal',
        name: 'Lapangan Event',
        pricePerHour: 120000,
        openHours: ALL_DAYS_OPEN,
      })
      .expect(201);
    courtId = court.body.id;

    const event = await request(app.getHttpServer())
      .post('/events')
      .set(auth(hostToken))
      .send({
        sport: 'Futsal',
        title: 'Event Booking Test',
        datetime: EVENT_DATETIME,
        lat: -6.2,
        lng: 106.8,
        capacity: 10,
      })
      .expect(201);
    eventId = event.body.id;
  });

  it('POST /events/:id/book tanpa token -> 401', async () => {
    await request(app.getHttpServer())
      .post(`/events/${eventId}/book`)
      .send({ courtId, date: EVENT_DAY, start: '09:00' })
      .expect(401);
  });

  it('bukan host/peserta -> 403', async () => {
    await request(app.getHttpServer())
      .post(`/events/${eventId}/book`)
      .set(auth(outsiderToken))
      .send({ courtId, date: EVENT_DAY, start: '09:00' })
      .expect(403);
  });

  it('tanggal beda dengan hari event -> 400', async () => {
    await request(app.getHttpServer())
      .post(`/events/${eventId}/book`)
      .set(auth(hostToken))
      .send({ courtId, date: OTHER_DAY, start: '09:00' })
      .expect(400);
  });

  it('host book OK -> 201 pending + eventId + snap stub', async () => {
    const res = await request(app.getHttpServer())
      .post(`/events/${eventId}/book`)
      .set(auth(hostToken))
      .send({ courtId, date: EVENT_DAY, start: '09:00' })
      .expect(201);
    expect(res.body.status).toBe('pending');
    expect(res.body.eventId).toBe(eventId);
    expect(res.body.courtId).toBe(courtId);
    expect(res.body.date).toBe(EVENT_DAY);
    expect(res.body.start).toBe('09:00');
    expect(res.body.amount).toBe(122500);
    expect(res.body.snapToken).toMatch(/^stub-snap-/);
  });

  it('GET /events/:id tampil booking info (court, slot, status)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/events/${eventId}`)
      .set(auth(hostToken))
      .expect(200);
    expect(res.body.id).toBe(eventId);
    expect(res.body.booking).toBeDefined();
    expect(res.body.booking).toMatchObject({
      courtId,
      date: EVENT_DAY,
      start: '09:00',
      status: 'pending',
      eventId,
    });
    expect(Array.isArray(res.body.bookings)).toBe(true);
    expect(res.body.bookings.length).toBeGreaterThanOrEqual(1);
  });

  it('slot sama (overlap) oleh peserta event lain -> 409', async () => {
    // Jadikan player peserta dulu agar lolos otorisasi (tetap 409 karena bentrok).
    await request(app.getHttpServer())
      .post(`/events/${eventId}/join`)
      .set(auth(playerToken))
      .expect(201);

    await request(app.getHttpServer())
      .post(`/events/${eventId}/book`)
      .set(auth(playerToken))
      .send({ courtId, date: EVENT_DAY, start: '09:00' })
      .expect(409);
  });

  it('peserta boleh ajukan di slot beda -> 201', async () => {
    const res = await request(app.getHttpServer())
      .post(`/events/${eventId}/book`)
      .set(auth(playerToken))
      .send({ courtId, date: EVENT_DAY, start: '08:00' })
      .expect(201);
    expect(res.body.eventId).toBe(eventId);
    expect(res.body.start).toBe('08:00');
  });

  it('cancel booking event ikut aturan BK-03 (pending -> cancelled)', async () => {
    const mine = await request(app.getHttpServer())
      .get('/bookings/me')
      .set(auth(playerToken))
      .expect(200);
    const booking = (
      mine.body.data as Array<{ id: string; start: string; eventId: string }>
    ).find((b) => b.eventId === eventId && b.start === '08:00');
    expect(booking).toBeDefined();

    const cancelled = await request(app.getHttpServer())
      .post(`/bookings/${booking!.id}/cancel`)
      .set(auth(playerToken))
      .expect(200);
    expect(cancelled.body.status).toBe('cancelled');
  });

  it('booking event tak dikenal -> 404', async () => {
    await request(app.getHttpServer())
      .post('/events/00000000-0000-4000-8000-000000000000/book')
      .set(auth(hostToken))
      .send({ courtId, date: EVENT_DAY, start: '10:00' })
      .expect(404);
  });

  afterAll(async () => {
    await app.close();
  });
});
