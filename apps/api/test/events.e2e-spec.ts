process.env.DB_DRIVER = 'sqljs';
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '7d';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';

describe('Events (e2e) SM-04', () => {
  let app: INestApplication;
  const email = `sm04_${Date.now()}@example.com`;
  const password = 'Password123!';
  let accessToken: string;
  let eventId: string;

  const payload = {
    sport: 'Futsal',
    title: 'Sparing Sabtu Pagi',
    description: 'Main santai, semua level welcome',
    datetime: '2026-10-03T09:00:00+07:00',
    lat: -6.2,
    lng: 106.8,
    capacity: 10,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    const reg = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, displayName: 'SM04 Host' })
      .expect(201);
    accessToken = reg.body.accessToken;
  });

  const auth = () => ({ Authorization: `Bearer ${accessToken}` });

  it('POST /events tanpa token -> 401', async () => {
    await request(app.getHttpServer()).post('/events').send(payload).expect(401);
  });

  it('POST /events -> 201, host otomatis peserta #1 (SM-05), status open', async () => {
    const res = await request(app.getHttpServer())
      .post('/events')
      .set(auth())
      .send(payload)
      .expect(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.sport).toBe('Futsal');
    expect(res.body.title).toBe(payload.title);
    expect(res.body.capacity).toBe(10);
    expect(res.body.participantsCount).toBe(1);
    expect(res.body.status).toBe('open');
    expect(res.body.host.email).toBe(email);
    eventId = res.body.id;
  });

  it('kolom location terisi (queryable) setelah create', async () => {
    const ds = app.get(DataSource);
    const rows = await ds.query('SELECT location FROM events WHERE id = ?', [eventId]);
    expect(rows.length).toBe(1);
    expect(String(rows[0].location)).toContain('POINT');
  });

  it('GET /events memuat event baru (default sort datetime ASC)', async () => {
    const res = await request(app.getHttpServer()).get('/events').set(auth()).expect(200);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
    const ids = (res.body.data as Array<{ id: string }>).map((e) => e.id);
    expect(ids).toContain(eventId);
  });

  it('GET /events?sport= memfilter case-insensitive', async () => {
    const hit = await request(app.getHttpServer())
      .get('/events')
      .query({ sport: 'futsal' })
      .set(auth())
      .expect(200);
    expect(hit.body.data.map((e: { id: string }) => e.id)).toContain(eventId);

    const miss = await request(app.getHttpServer())
      .get('/events')
      .query({ sport: 'Basket' })
      .set(auth())
      .expect(200);
    expect(miss.body.data.map((e: { id: string }) => e.id)).not.toContain(eventId);
  });

  it('GET /events?from=&to= memfilter rentang datetime', async () => {
    const inside = await request(app.getHttpServer())
      .get('/events')
      .query({ from: '2026-10-01T00:00:00+07:00', to: '2026-10-05T00:00:00+07:00' })
      .set(auth())
      .expect(200);
    expect(inside.body.data.map((e: { id: string }) => e.id)).toContain(eventId);

    const outside = await request(app.getHttpServer())
      .get('/events')
      .query({ from: '2026-11-01T00:00:00+07:00' })
      .set(auth())
      .expect(200);
    expect(outside.body.data.map((e: { id: string }) => e.id)).not.toContain(eventId);
  });

  it('GET /events?lat=&lng=&radius= memfilter lingkaran geo', async () => {
    const near = await request(app.getHttpServer())
      .get('/events')
      .query({ lat: -6.2, lng: 106.8, radius: 5000 })
      .set(auth())
      .expect(200);
    expect(near.body.data.map((e: { id: string }) => e.id)).toContain(eventId);

    const far = await request(app.getHttpServer())
      .get('/events')
      .query({ lat: -7.25, lng: 112.75, radius: 5000 })
      .set(auth())
      .expect(200);
    expect(far.body.data.map((e: { id: string }) => e.id)).not.toContain(eventId);
  });

  it('GET /events?page=&limit= paginasi + meta', async () => {
    const res = await request(app.getHttpServer())
      .get('/events')
      .query({ page: 1, limit: 1 })
      .set(auth())
      .expect(200);
    expect(res.body.data.length).toBeLessThanOrEqual(1);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 1 });
    expect(typeof res.body.meta.total).toBe('number');
  });

  it('GET /events/:id detail benar + host info + isJoined=true (host peserta #1)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/events/${eventId}`)
      .set(auth())
      .expect(200);
    expect(res.body.id).toBe(eventId);
    expect(res.body.title).toBe(payload.title);
    expect(res.body.status).toBe('open');
    expect(res.body.participantsCount).toBe(1);
    expect(res.body.host.email).toBe(email);
    expect(res.body.isJoined).toBe(true);
  });

  it('GET /events/:id tidak ada -> 404', async () => {
    await request(app.getHttpServer())
      .get('/events/00000000-0000-4000-8000-000000000000')
      .set(auth())
      .expect(404);
  });

  it('POST /events validasi: capacity < 2 -> 400', async () => {
    await request(app.getHttpServer())
      .post('/events')
      .set(auth())
      .send({ ...payload, title: 'Kapasitas invalid', capacity: 1 })
      .expect(400);
  });

  it('POST /events validasi: lat di luar rentang -> 400', async () => {
    await request(app.getHttpServer())
      .post('/events')
      .set(auth())
      .send({ ...payload, title: 'Lat invalid', lat: 120 })
      .expect(400);
  });

  afterAll(async () => {
    await app.close();
  });
});
