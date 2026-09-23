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
import { User } from '../src/users/user.entity';

describe('Walk-in + blocks API-W06, check-in API-W07 (e2e)', () => {
  let app: INestApplication;
  let users: Repository<User>;
  let bookings: Repository<Booking>;
  const ts = Date.now();
  const password = 'Password123!';

  let ownerToken: string;
  let owner2Token: string;
  let adminToken: string;
  let userToken: string;
  let courtId: string;
  let court2Id: string;

  const DATE = '2030-08-20';
  const ALL_DAYS_OPEN = {
    mon: ['08:00-18:00'],
    tue: ['08:00-18:00'],
    wed: ['08:00-18:00'],
    thu: ['08:00-18:00'],
    fri: ['08:00-18:00'],
    sat: ['08:00-18:00'],
    sun: ['08:00-18:00'],
  };

  const login = async (email: string) =>
    (
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(200)
    ).body.accessToken as string;

  async function slotStatus(start: string): Promise<string | undefined> {
    const res = await request(app.getHttpServer())
      .get(`/courts/${courtId}/availability`)
      .set({ Authorization: `Bearer ${userToken}` })
      .query({ date: DATE })
      .expect(200);
    return (
      res.body.slots as Array<{ start: string; status: string }>
    ).find((s) => s.start === start)?.status;
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
    bookings = app.get<Repository<Booking>>(getRepositoryToken(Booking));

    const ownerEmail = `w0607_owner_${ts}@example.com`;
    const regOwner = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: ownerEmail, password })
      .expect(201);
    await users.update({ id: regOwner.body.user.id }, { role: 'venue_owner' });
    ownerToken = await login(ownerEmail);

    const owner2Email = `w0607_owner2_${ts}@example.com`;
    const regOwner2 = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: owner2Email, password })
      .expect(201);
    await users.update(
      { id: regOwner2.body.user.id },
      { role: 'venue_owner' },
    );
    owner2Token = await login(owner2Email);

    const adminEmail = `w0607_admin_${ts}@example.com`;
    const regAdmin = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: adminEmail, password })
      .expect(201);
    await users.update(
      { id: regAdmin.body.user.id },
      { role: 'super_admin' },
    );
    adminToken = await login(adminEmail);

    userToken = (
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: `w0607_user_${ts}@example.com`, password })
        .expect(201)
    ).body.accessToken as string;

    const authOwner = () => ({ Authorization: `Bearer ${ownerToken}` });
    const authOwner2 = () => ({ Authorization: `Bearer ${owner2Token}` });

    const venue = await request(app.getHttpServer())
      .post('/venues')
      .set(authOwner())
      .send({
        name: 'GOR W06',
        address: 'Jl. Walkin No. 6',
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
        name: 'Lapangan Walkin',
        pricePerHour: 100000,
        openHours: ALL_DAYS_OPEN,
      })
      .expect(201);
    courtId = court.body.id;

    const venue2 = await request(app.getHttpServer())
      .post('/venues')
      .set(authOwner2())
      .send({
        name: 'GOR W06 Lain',
        address: 'Jl. Lain No. 7',
        lat: -6.3,
        lng: 106.9,
        sports: ['Futsal'],
      })
      .expect(201);
    const court2 = await request(app.getHttpServer())
      .post(`/venues/${venue2.body.id}/courts`)
      .set(authOwner2())
      .send({
        sport: 'Futsal',
        name: 'Lapangan Lain',
        pricePerHour: 100000,
        openHours: ALL_DAYS_OPEN,
      })
      .expect(201);
    court2Id = court2.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ---------- API-W06: walk-in ----------

  it('POST /bookings/walk-in tanpa token -> 401', async () => {
    await request(app.getHttpServer())
      .post('/bookings/walk-in')
      .send({ courtId, date: DATE, start: '08:00', buyerName: 'Anon' })
      .expect(401);
  });

  it('walk-in sukses -> 201 paid tanpa snap + code + channel walkin', async () => {
    const res = await request(app.getHttpServer())
      .post('/bookings/walk-in')
      .set({ Authorization: `Bearer ${ownerToken}` })
      .send({ courtId, date: DATE, start: '08:00', buyerName: 'Budi Walkin' })
      .expect(201);
    expect(res.body.status).toBe('paid');
    expect(res.body.channel).toBe('walkin');
    expect(res.body.buyerName).toBe('Budi Walkin');
    expect(res.body.paymentRef).toMatch(/^WALKIN-/);
    expect(res.body.snapToken).toBeNull();
    expect(res.body.redirectUrl).toBeNull();
    expect(res.body.amount).toBe(100000);
    expect(res.body.serviceFee).toBe(0);
    expect(res.body.code).toMatch(/^KS-[A-Z2-9]{6}$/);
    expect(res.body.paidAt).toBeTruthy();
    expect(res.body.createdBy).toBeTruthy();
    expect(await slotStatus('08:00')).toBe('booked');
  });

  it('walk-in lintas owner -> 403; user biasa -> 403', async () => {
    await request(app.getHttpServer())
      .post('/bookings/walk-in')
      .set({ Authorization: `Bearer ${owner2Token}` })
      .send({ courtId, date: DATE, start: '09:00', buyerName: 'X' })
      .expect(403);
    await request(app.getHttpServer())
      .post('/bookings/walk-in')
      .set({ Authorization: `Bearer ${userToken}` })
      .send({ courtId, date: DATE, start: '09:00', buyerName: 'X' })
      .expect(403);
  });

  it('walk-in super_admin lolos (audit createdBy = admin)', async () => {
    const res = await request(app.getHttpServer())
      .post('/bookings/walk-in')
      .set({ Authorization: `Bearer ${adminToken}` })
      .send({ courtId, date: DATE, start: '09:00', buyerName: 'Admin Input' })
      .expect(201);
    expect(res.body.status).toBe('paid');
    expect(res.body.channel).toBe('walkin');
  });

  it('double-book vs walk-in -> 409 dua arah', async () => {
    // Slot walk-in 08:00 tak bisa dibooking app.
    await request(app.getHttpServer())
      .post('/bookings')
      .set({ Authorization: `Bearer ${userToken}` })
      .send({ courtId, date: DATE, start: '08:00' })
      .expect(409);
    // Booking app dulu di 10:00, lalu walk-in di slot sama -> 409.
    await request(app.getHttpServer())
      .post('/bookings')
      .set({ Authorization: `Bearer ${userToken}` })
      .send({ courtId, date: DATE, start: '10:00' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/bookings/walk-in')
      .set({ Authorization: `Bearer ${ownerToken}` })
      .send({ courtId, date: DATE, start: '10:00', buyerName: 'Telat' })
      .expect(409);
  });

  it('walk-in validasi: buyerName wajib; amount custom dipakai', async () => {
    await request(app.getHttpServer())
      .post('/bookings/walk-in')
      .set({ Authorization: `Bearer ${ownerToken}` })
      .send({ courtId, date: DATE, start: '11:00' })
      .expect(400);
    const res = await request(app.getHttpServer())
      .post('/bookings/walk-in')
      .set({ Authorization: `Bearer ${ownerToken}` })
      .send({
        courtId,
        date: DATE,
        start: '11:00',
        buyerName: 'Diskon',
        amount: 50000,
      })
      .expect(201);
    expect(res.body.amount).toBe(50000);
  });

  // ---------- API-W06: slot blocks ----------

  it('POST /courts/:id/blocks tanpa token -> 401; lintas owner -> 403', async () => {
    await request(app.getHttpServer())
      .post(`/courts/${courtId}/blocks`)
      .send({ date: DATE, start: '12:00' })
      .expect(401);
    await request(app.getHttpServer())
      .post(`/courts/${courtId}/blocks`)
      .set({ Authorization: `Bearer ${owner2Token}` })
      .send({ date: DATE, start: '12:00' })
      .expect(403);
  });

  it('block menutup slot: availability=blocked, booking/hold/walk-in ditolak', async () => {
    const created = await request(app.getHttpServer())
      .post(`/courts/${courtId}/blocks`)
      .set({ Authorization: `Bearer ${ownerToken}` })
      .send({ date: DATE, start: '12:00', reason: 'Maintenance AC' })
      .expect(201);
    expect(created.body).toMatchObject({
      courtId,
      date: DATE,
      start: '12:00',
      end: '13:00',
      reason: 'Maintenance AC',
    });

    expect(await slotStatus('12:00')).toBe('blocked');
    // Slot lain tidak terdampak.
    expect(await slotStatus('13:00')).toBe('free');

    await request(app.getHttpServer())
      .post('/bookings')
      .set({ Authorization: `Bearer ${userToken}` })
      .send({ courtId, date: DATE, start: '12:00' })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/courts/${courtId}/hold`)
      .set({ Authorization: `Bearer ${userToken}` })
      .send({ date: DATE, start: '12:00' })
      .expect(409);
    await request(app.getHttpServer())
      .post('/bookings/walk-in')
      .set({ Authorization: `Bearer ${ownerToken}` })
      .send({ courtId, date: DATE, start: '12:00', buyerName: 'Nekat' })
      .expect(409);

    // Duplikat exact -> 409; di luar open hours -> 400.
    await request(app.getHttpServer())
      .post(`/courts/${courtId}/blocks`)
      .set({ Authorization: `Bearer ${ownerToken}` })
      .send({ date: DATE, start: '12:00' })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/courts/${courtId}/blocks`)
      .set({ Authorization: `Bearer ${ownerToken}` })
      .send({ date: DATE, start: '19:00' })
      .expect(400);

    // List memuat blokir (filter date).
    const list = await request(app.getHttpServer())
      .get(`/courts/${courtId}/blocks`)
      .set({ Authorization: `Bearer ${ownerToken}` })
      .query({ date: DATE })
      .expect(200);
    expect(
      (list.body.data as Array<{ start: string }>).map((b) => b.start),
    ).toContain('12:00');

    // Unblock -> slot bebas lagi + bisa dibooking.
    await request(app.getHttpServer())
      .delete(`/courts/${courtId}/blocks/${created.body.id}`)
      .set({ Authorization: `Bearer ${ownerToken}` })
      .expect(200);
    expect(await slotStatus('12:00')).toBe('free');
    await request(app.getHttpServer())
      .post('/bookings')
      .set({ Authorization: `Bearer ${userToken}` })
      .send({ courtId, date: DATE, start: '12:00' })
      .expect(201);
  });

  it('DELETE block tak ada -> 404; block court lain via path salah -> 404', async () => {
    const created = await request(app.getHttpServer())
      .post(`/courts/${courtId}/blocks`)
      .set({ Authorization: `Bearer ${ownerToken}` })
      .send({ date: DATE, start: '13:00' })
      .expect(201);
    await request(app.getHttpServer())
      .delete(`/courts/${courtId}/blocks/00000000-0000-0000-0000-000000000000`)
      .set({ Authorization: `Bearer ${ownerToken}` })
      .expect(404);
    // Block milik courtId diakses via court2Id -> 404 (bukan bocor).
    await request(app.getHttpServer())
      .delete(`/courts/${court2Id}/blocks/${created.body.id}`)
      .set({ Authorization: `Bearer ${owner2Token}` })
      .expect(404);
    // Bersih-bersih.
    await request(app.getHttpServer())
      .delete(`/courts/${courtId}/blocks/${created.body.id}`)
      .set({ Authorization: `Bearer ${ownerToken}` })
      .expect(200);
  });

  // ---------- API-W07: check-in via kode ----------

  it('booking app punya code; by-code owner ok, lintas owner 404, kode asing 404', async () => {
    const created = await request(app.getHttpServer())
      .post('/bookings')
      .set({ Authorization: `Bearer ${userToken}` })
      .send({ courtId, date: DATE, start: '14:00' })
      .expect(201);
    expect(created.body.code).toMatch(/^KS-[A-Z2-9]{6}$/);
    expect(created.body.channel).toBe('app');

    const found = await request(app.getHttpServer())
      .get(`/bookings/by-code/${created.body.code}`)
      .set({ Authorization: `Bearer ${ownerToken}` })
      .expect(200);
    expect(found.body.id).toBe(created.body.id);

    await request(app.getHttpServer())
      .get(`/bookings/by-code/${created.body.code}`)
      .set({ Authorization: `Bearer ${owner2Token}` })
      .expect(404);
    await request(app.getHttpServer())
      .get('/bookings/by-code/KS-ZZZZZZ')
      .set({ Authorization: `Bearer ${ownerToken}` })
      .expect(404);
    await request(app.getHttpServer())
      .get(`/bookings/by-code/${created.body.code}`)
      .expect(401);
  });

  it('check-in walk-in (paid) 200 + checkedInAt; ulang 409', async () => {
    const walkin = await request(app.getHttpServer())
      .post('/bookings/walk-in')
      .set({ Authorization: `Bearer ${ownerToken}` })
      .send({ courtId, date: DATE, start: '15:00', buyerName: 'Checkin Guy' })
      .expect(201);

    const first = await request(app.getHttpServer())
      .post(`/bookings/${walkin.body.id}/check-in`)
      .set({ Authorization: `Bearer ${ownerToken}` })
      .expect(200);
    expect(first.body.checkedInAt).toBeTruthy();
    expect(first.body.code).toBe(walkin.body.code);

    await request(app.getHttpServer())
      .post(`/bookings/${walkin.body.id}/check-in`)
      .set({ Authorization: `Bearer ${ownerToken}` })
      .expect(409);

    // Lintas owner -> 404.
    await request(app.getHttpServer())
      .post(`/bookings/${walkin.body.id}/check-in`)
      .set({ Authorization: `Bearer ${owner2Token}` })
      .expect(404);
  });

  it('booking pending/cancelled/expired tak bisa check-in -> 409', async () => {
    // pending (belum bayar) -> 409.
    const pending = await request(app.getHttpServer())
      .post('/bookings')
      .set({ Authorization: `Bearer ${userToken}` })
      .send({ courtId, date: DATE, start: '16:00' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/bookings/${pending.body.id}/check-in`)
      .set({ Authorization: `Bearer ${ownerToken}` })
      .expect(409);

    // cancelled -> 409.
    await request(app.getHttpServer())
      .post(`/bookings/${pending.body.id}/cancel`)
      .set({ Authorization: `Bearer ${userToken}` })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/bookings/${pending.body.id}/check-in`)
      .set({ Authorization: `Bearer ${ownerToken}` })
      .expect(409);

    // expired (backdate 31 mnt, expire oportunistik saat check-in) -> 409.
    const aging = await request(app.getHttpServer())
      .post('/bookings')
      .set({ Authorization: `Bearer ${userToken}` })
      .send({ courtId, date: DATE, start: '17:00' })
      .expect(201);
    await bookings.update(
      { id: aging.body.id },
      { createdAt: new Date(Date.now() - 31 * 60 * 1000) },
    );
    await request(app.getHttpServer())
      .post(`/bookings/${aging.body.id}/check-in`)
      .set({ Authorization: `Bearer ${ownerToken}` })
      .expect(409);
    const row = await bookings.findOneOrFail({ where: { id: aging.body.id } });
    expect(row.status).toBe('expired');
  });
});
