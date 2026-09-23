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
import { Booking } from '../src/bookings/booking.entity';
import { Rating } from '../src/ratings/rating.entity';
import { User } from '../src/users/user.entity';

describe('Venue owner analytics API-W05 (e2e)', () => {
  let app: INestApplication;
  let users: Repository<User>;
  let bookings: Repository<Booking>;
  let ratings: Repository<Rating>;
  const ts = Date.now();
  const password = 'Password123!';

  let ownerToken: string;
  let owner2Token: string;
  let adminToken: string;
  let userToken: string;
  let raterBToken: string;

  let venueId: string;
  let owner2VenueId: string;
  let courtAId: string;
  let courtBId: string;

  const DATE = '2030-07-15';
  const ALL_DAYS_OPEN = {
    mon: ['08:00-10:00'],
    tue: ['08:00-10:00'],
    wed: ['08:00-10:00'],
    thu: ['08:00-10:00'],
    fri: ['08:00-10:00'],
    sat: ['08:00-10:00'],
    sun: ['08:00-10:00'],
  };

  const login = async (email: string) =>
    (
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(200)
    ).body.accessToken as string;

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
    bookings = app.get<Repository<Booking>>(getRepositoryToken(Booking));
    ratings = app.get<Repository<Rating>>(getRepositoryToken(Rating));

    // owner1 (pemilik venue utama).
    const ownerEmail = `w05_owner_${ts}@example.com`;
    const regOwner = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: ownerEmail, password })
      .expect(201);
    await users.update(
      { id: regOwner.body.user.id },
      { role: 'venue_owner' },
    );
    ownerToken = await login(ownerEmail);
    const authOwner = () => ({ Authorization: `Bearer ${ownerToken}` });

    // owner2 (venue lain — untuk uji 403 lintas owner).
    const owner2Email = `w05_owner2_${ts}@example.com`;
    const regOwner2 = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: owner2Email, password })
      .expect(201);
    await users.update(
      { id: regOwner2.body.user.id },
      { role: 'venue_owner' },
    );
    owner2Token = await login(owner2Email);
    const authOwner2 = () => ({ Authorization: `Bearer ${owner2Token}` });

    // super_admin.
    const adminEmail = `w05_admin_${ts}@example.com`;
    const regAdmin = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: adminEmail, password })
      .expect(201);
    await users.update(
      { id: regAdmin.body.user.id },
      { role: 'super_admin' },
    );
    adminToken = await login(adminEmail);
    const authAdmin = () => ({ Authorization: `Bearer ${adminToken}` });

    // user biasa (booking + rating) + rater kedua.
    const userEmail = `w05_user_${ts}@example.com`;
    const regUser = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: userEmail, password })
      .expect(201);
    userToken = regUser.body.accessToken as string;
    const authUser = () => ({ Authorization: `Bearer ${userToken}` });

    raterBToken = (
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: `w05_raterb_${ts}@example.com`, password })
        .expect(201)
    ).body.accessToken as string;

    // Venue owner1 + approve + 2 court (masing-masing 2 slot/hari).
    const venue = await request(app.getHttpServer())
      .post('/venues')
      .set(authOwner())
      .send({
        name: 'GOR W05',
        address: 'Jl. Analitik No. 5',
        lat: -6.2,
        lng: 106.8,
        sports: ['Futsal'],
      })
      .expect(201);
    venueId = venue.body.id;
    await request(app.getHttpServer())
      .post(`/venues/${venueId}/approve`)
      .set(authAdmin())
      .expect(201);

    const courtA = await request(app.getHttpServer())
      .post(`/venues/${venueId}/courts`)
      .set(authOwner())
      .send({
        sport: 'Futsal',
        name: 'Court A',
        pricePerHour: 100000,
        openHours: ALL_DAYS_OPEN,
      })
      .expect(201);
    courtAId = courtA.body.id;

    const courtB = await request(app.getHttpServer())
      .post(`/venues/${venueId}/courts`)
      .set(authOwner())
      .send({
        sport: 'Futsal',
        name: 'Court B',
        pricePerHour: 200000,
        openHours: ALL_DAYS_OPEN,
      })
      .expect(201);
    courtBId = courtB.body.id;

    // Venue owner2 (untuk /mine + 403 lintas owner).
    const venue2 = await request(app.getHttpServer())
      .post('/venues')
      .set(authOwner2())
      .send({
        name: 'GOR W05 Lain',
        address: 'Jl. Lain No. 9',
        lat: -6.3,
        lng: 106.9,
        sports: ['Basket'],
      })
      .expect(201);
    owner2VenueId = venue2.body.id;

    // 3 booking via API (pending): A/08:00, A/09:00, B/08:00.
    // amount = price + service fee default 2500.
    const b1 = await request(app.getHttpServer())
      .post('/bookings')
      .set(authUser())
      .send({ courtId: courtAId, date: DATE, start: '08:00' })
      .expect(201);
    expect(b1.body.amount).toBe(102500);
    const b2 = await request(app.getHttpServer())
      .post('/bookings')
      .set(authUser())
      .send({ courtId: courtAId, date: DATE, start: '09:00' })
      .expect(201);
    expect(b2.body.amount).toBe(102500);
    const b3 = await request(app.getHttpServer())
      .post('/bookings')
      .set(authUser())
      .send({ courtId: courtBId, date: DATE, start: '08:00' })
      .expect(201);
    expect(b3.body.amount).toBe(202500);

    // 2 paid (A/08:00 + B/08:00), 1 tetap pending (A/09:00).
    await bookings.update(
      { id: b1.body.id },
      { status: 'paid', paidAt: new Date() },
    );
    await bookings.update(
      { id: b3.body.id },
      { status: 'paid', paidAt: new Date() },
    );

    // 2 rating venue: skor 4 + 5 → avg 4.5, count 2.
    await request(app.getHttpServer())
      .post('/ratings')
      .set(authUser())
      .send({ venueId, score: 4, comment: 'Bagus' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/ratings')
      .set({ Authorization: `Bearer ${raterBToken}` })
      .send({ venueId, score: 5, comment: 'Mantap' })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /venues/:id/stats tanpa token -> 401', async () => {
    await request(app.getHttpServer())
      .get(`/venues/${venueId}/stats`)
      .query({ date: DATE })
      .expect(401);
  });

  it('GET /venues/:id/stats user biasa -> 403', async () => {
    await request(app.getHttpServer())
      .get(`/venues/${venueId}/stats`)
      .set({ Authorization: `Bearer ${userToken}` })
      .query({ date: DATE })
      .expect(403);
  });

  it('GET /venues/:id/stats lintas owner -> 403', async () => {
    await request(app.getHttpServer())
      .get(`/venues/${venueId}/stats`)
      .set({ Authorization: `Bearer ${owner2Token}` })
      .query({ date: DATE })
      .expect(403);
  });

  it('GET /venues/:id/stats owner sendiri -> angka benar', async () => {
    const res = await request(app.getHttpServer())
      .get(`/venues/${venueId}/stats`)
      .set({ Authorization: `Bearer ${ownerToken}` })
      .query({ date: DATE })
      .expect(200);

    expect(res.body.venueId).toBe(venueId);
    // Occupancy: 2 court × 2 slot = 4; terisi 3 (2 paid + 1 pending).
    expect(res.body.occupancy).toMatchObject({
      date: DATE,
      totalSlots: 4,
      bookedSlots: 3,
      pct: 75,
    });
    // Reservations: semua booking venue ini.
    expect(res.body.reservations.total).toBe(3);
    expect(res.body.reservations.byStatus).toMatchObject({
      pending: 1,
      paid: 2,
      expired: 0,
      cancelled: 0,
    });
    // Revenue: 2 paid → gmv 102500+202500; komisi default 5%.
    expect(res.body.revenue).toMatchObject({
      paidCount: 2,
      gmv: 305000,
      commissionPercent: 5,
      net: 289750,
    });
    // Rating: (4+5)/2.
    expect(res.body.rating).toMatchObject({ avg: 4.5, count: 2 });
    // Top courts: B dulu (gmv lebih besar).
    expect(res.body.topCourts).toHaveLength(2);
    expect(res.body.topCourts[0]).toMatchObject({
      courtId: courtBId,
      courtName: 'Court B',
      booked: 1,
      gmv: 202500,
    });
    expect(res.body.topCourts[1]).toMatchObject({
      courtId: courtAId,
      courtName: 'Court A',
      booked: 1,
      gmv: 102500,
    });
  });

  it('GET /venues/:id/stats super_admin lolos', async () => {
    const res = await request(app.getHttpServer())
      .get(`/venues/${venueId}/stats`)
      .set({ Authorization: `Bearer ${adminToken}` })
      .query({ date: DATE })
      .expect(200);
    expect(res.body.revenue.gmv).toBe(305000);
  });

  it('GET /venues/:id/stats tanggal invalid -> 400; venue tak ada -> 404', async () => {
    await request(app.getHttpServer())
      .get(`/venues/${venueId}/stats`)
      .set({ Authorization: `Bearer ${ownerToken}` })
      .query({ date: '2030-02-30' })
      .expect(400);
    await request(app.getHttpServer())
      .get('/venues/00000000-0000-0000-0000-000000000000/stats')
      .set({ Authorization: `Bearer ${ownerToken}` })
      .query({ date: DATE })
      .expect(404);
  });

  it('GET /venues/:id/stats tanpa date -> default hari ini', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await request(app.getHttpServer())
      .get(`/venues/${venueId}/stats`)
      .set({ Authorization: `Bearer ${ownerToken}` })
      .expect(200);
    expect(res.body.occupancy.date).toBe(today);
  });

  it('net mengikuti commission_percent API-W03', async () => {
    await request(app.getHttpServer())
      .put('/admin/settings')
      .set({ Authorization: `Bearer ${adminToken}` })
      .send({ commission_percent: 10 })
      .expect(200);
    const res = await request(app.getHttpServer())
      .get(`/venues/${venueId}/stats`)
      .set({ Authorization: `Bearer ${ownerToken}` })
      .query({ date: DATE })
      .expect(200);
    expect(res.body.revenue.commissionPercent).toBe(10);
    expect(res.body.revenue.net).toBe(274500);
    // Kembalikan default agar suite lain stabil.
    await request(app.getHttpServer())
      .put('/admin/settings')
      .set({ Authorization: `Bearer ${adminToken}` })
      .send({ commission_percent: 5 })
      .expect(200);
  });

  it('GET /venues/mine hanya milik sendiri', async () => {
    const mine = await request(app.getHttpServer())
      .get('/venues/mine')
      .set({ Authorization: `Bearer ${ownerToken}` })
      .expect(200);
    expect(mine.body.data.map((v: { id: string }) => v.id)).toEqual([venueId]);
    expect(mine.body.data[0]).toMatchObject({
      id: venueId,
      name: 'GOR W05',
      courtsCount: 2,
    });
    expect(mine.body.meta).toMatchObject({ total: 1 });

    const mine2 = await request(app.getHttpServer())
      .get('/venues/mine')
      .set({ Authorization: `Bearer ${owner2Token}` })
      .expect(200);
    expect(mine2.body.data.map((v: { id: string }) => v.id)).toEqual([
      owner2VenueId,
    ]);
  });

  it('GET /venues/mine: user biasa -> 403; owner ?all=true -> 403', async () => {
    await request(app.getHttpServer())
      .get('/venues/mine')
      .set({ Authorization: `Bearer ${userToken}` })
      .expect(403);
    await request(app.getHttpServer())
      .get('/venues/mine')
      .set({ Authorization: `Bearer ${ownerToken}` })
      .query({ all: 'true' })
      .expect(403);
  });

  it('GET /venues/mine super_admin: default milik sendiri, ?all=true semua', async () => {
    const own = await request(app.getHttpServer())
      .get('/venues/mine')
      .set({ Authorization: `Bearer ${adminToken}` })
      .expect(200);
    expect(
      (own.body.data as Array<{ id: string }>).map((v) => v.id),
    ).not.toContain(venueId);

    const all = await request(app.getHttpServer())
      .get('/venues/mine')
      .set({ Authorization: `Bearer ${adminToken}` })
      .query({ all: 'true' })
      .expect(200);
    const ids = (all.body.data as Array<{ id: string }>).map((v) => v.id);
    expect(ids).toEqual(expect.arrayContaining([venueId, owner2VenueId]));
    expect(all.body.meta.total).toBeGreaterThanOrEqual(2);
  });
});
