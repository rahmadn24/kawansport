process.env.DB_DRIVER = 'sqljs';
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '7d';
// Paksa mode stub Midtrans (tanpa network/key): signature dihitung dengan key kosong.
process.env.MIDTRANS_SERVER_KEY = '';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { User, UserRole } from '../src/users/user.entity';

describe('ST-10 facilities + rentals + booking rentals (e2e)', () => {
  let app: INestApplication;
  let users: Repository<User>;
  const ts = Date.now();
  const password = 'Password123!';

  let ownerToken: string;
  let owner2Token: string;
  let userToken: string;
  let adminToken: string;

  let venueId: string;
  let venue2Id: string;
  let courtId: string;
  let rental1Id: string;
  let rental2Id: string;
  let otherRentalId: string;

  const DATE = '2030-07-20';
  const ALL_DAYS_OPEN = {
    mon: ['08:00-12:00'],
    tue: ['08:00-12:00'],
    wed: ['08:00-12:00'],
    thu: ['08:00-12:00'],
    fri: ['08:00-12:00'],
    sat: ['08:00-12:00'],
    sun: ['08:00-12:00'],
  };

  const authOwner = () => ({ Authorization: `Bearer ${ownerToken}` });
  const authOwner2 = () => ({ Authorization: `Bearer ${owner2Token}` });
  const authUser = () => ({ Authorization: `Bearer ${userToken}` });
  const authAdmin = () => ({ Authorization: `Bearer ${adminToken}` });

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

    async function makeUser(email: string, role?: UserRole): Promise<string> {
      const reg = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password })
        .expect(201);
      if (role) await users.update({ id: reg.body.user.id }, { role });
      return (
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email, password })
          .expect(200)
      ).body.accessToken;
    }

    ownerToken = await makeUser(`st10_owner_${ts}@example.com`, 'venue_owner');
    owner2Token = await makeUser(
      `st10_owner2_${ts}@example.com`,
      'venue_owner',
    );
    userToken = await makeUser(`st10_user_${ts}@example.com`);
    adminToken = await makeUser(
      `st10_admin_${ts}@example.com`,
      'super_admin',
    );

    const venue = await request(app.getHttpServer())
      .post('/venues')
      .set(authOwner())
      .send({
        name: 'GOR ST10',
        address: 'Jl. Sewa No. 10',
        lat: -6.2,
        lng: 106.8,
        sports: ['Futsal'],
        facilities: ['Wifi', ' PARKIR ', 'wifi'],
      })
      .expect(201);
    venueId = venue.body.id;
    // Normalisasi: lowercase + trim + dedupe, jaga urutan.
    expect(venue.body.facilities).toEqual(['wifi', 'parkir']);

    const court = await request(app.getHttpServer())
      .post(`/venues/${venueId}/courts`)
      .set(authOwner())
      .send({
        sport: 'Futsal',
        name: 'Lapangan Sewa',
        pricePerHour: 100000,
        openHours: ALL_DAYS_OPEN,
        facilities: [' tribun ', 'SHOWER'],
      })
      .expect(201);
    courtId = court.body.id;
    expect(court.body.facilities).toEqual(['tribun', 'shower']);

    // Venue kedua (milik owner2) untuk uji lintas venue.
    const venue2 = await request(app.getHttpServer())
      .post('/venues')
      .set(authOwner2())
      .send({
        name: 'GOR ST10 Lain',
        address: 'Jl. Lain No. 2',
        lat: -6.21,
        lng: 106.81,
        sports: ['Futsal'],
      })
      .expect(201);
    venue2Id = venue2.body.id;
    const otherRental = await request(app.getHttpServer())
      .post(`/venues/${venue2Id}/rentals`)
      .set(authOwner2())
      .send({ name: 'Bola lain', price: 10000, stock: 10 })
      .expect(201);
    otherRentalId = otherRental.body.id;

    // Approve venue utama agar uji visibilitas publik + PATCH langsung.
    await request(app.getHttpServer())
      .post(`/venues/${venueId}/approve`)
      .set(authAdmin())
      .expect(201);

    const r1 = await request(app.getHttpServer())
      .post(`/venues/${venueId}/rentals`)
      .set(authOwner())
      .send({ name: 'Bola futsal', price: 20000, stock: 5, unit: 'pcs' })
      .expect(201);
    rental1Id = r1.body.id;
    expect(r1.body).toMatchObject({
      venueId,
      name: 'Bola futsal',
      price: 20000,
      stock: 5,
      unit: 'pcs',
      status: 'active',
    });

    const r2 = await request(app.getHttpServer())
      .post(`/venues/${venueId}/rentals`)
      .set(authOwner())
      .send({ name: 'Sepatu', price: 15000, stock: 1, unit: 'pasang' })
      .expect(201);
    rental2Id = r2.body.id;
  });

  it('POST /venues dengan fasilitas asing -> 400', async () => {
    await request(app.getHttpServer())
      .post('/venues')
      .set(authOwner())
      .send({
        name: 'GOR Fasilitas Asing',
        address: 'Jl. Asing No. 1',
        lat: -6.2,
        lng: 106.8,
        sports: ['Futsal'],
        facilities: ['kolam'],
      })
      .expect(400);
  });

  it('PATCH fasilitas venue approved oleh owner -> 200 langsung (non-sensitif AD-02)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/venues/${venueId}`)
      .set(authOwner())
      .send({ facilities: ['kantin', 'MUSHOLA'] })
      .expect(200);
    expect(res.body.facilities).toEqual(['kantin', 'mushola']);

    // Kontrol: field sensitif tetap lewat CR 202.
    const cr = await request(app.getHttpServer())
      .patch(`/venues/${venueId}`)
      .set(authOwner())
      .send({ name: 'GOR ST10 Ganti Nama' })
      .expect(202);
    expect(cr.body.pendingReview).toBe(true);
  });

  it('PATCH fasilitas asing -> 400', async () => {
    await request(app.getHttpServer())
      .patch(`/venues/${venueId}`)
      .set(authOwner())
      .send({ facilities: ['helipad'] })
      .expect(400);
  });

  it('PATCH fasilitas court venue approved oleh owner -> 200 langsung', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/venues/${venueId}/courts/${courtId}`)
      .set(authOwner())
      .send({ facilities: ['toilet', 'loker'] })
      .expect(200);
    expect(res.body.facilities).toEqual(['toilet', 'loker']);
  });

  it('rentals: lintas owner -> 403; publik lihat aktif saja', async () => {
    await request(app.getHttpServer())
      .post(`/venues/${venueId}/rentals`)
      .set(authOwner2())
      .send({ name: 'Nakal', price: 1000, stock: 1 })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/venues/${venueId}/rentals/${rental1Id}`)
      .set(authOwner2())
      .send({ price: 1 })
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/venues/${venueId}/rentals/${rental1Id}`)
      .set(authOwner2())
      .expect(403);

    // Nonaktifkan satu item, publik hanya lihat yang aktif.
    await request(app.getHttpServer())
      .patch(`/venues/${venueId}/rentals/${rental2Id}`)
      .set(authOwner())
      .send({ status: 'inactive' })
      .expect(200);

    const pub = await request(app.getHttpServer())
      .get(`/venues/${venueId}/rentals`)
      .expect(200);
    expect(pub.body.meta.total).toBe(1);
    expect(pub.body.data.map((r: { id: string }) => r.id)).toEqual([
      rental1Id,
    ]);

    // Owner melihat semua termasuk inactive.
    const mine = await request(app.getHttpServer())
      .get(`/venues/${venueId}/rentals`)
      .set(authOwner())
      .expect(200);
    expect(mine.body.meta.total).toBe(2);

    // Aktifkan lagi untuk uji booking.
    await request(app.getHttpServer())
      .patch(`/venues/${venueId}/rentals/${rental2Id}`)
      .set(authOwner())
      .send({ status: 'active' })
      .expect(200);
  });

  it('rentals: item venue lain / venue tak ada -> 404', async () => {
    await request(app.getHttpServer())
      .patch(`/venues/${venueId}/rentals/${otherRentalId}`)
      .set(authOwner())
      .send({ price: 999 })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/venues/${venueId}/rentals/${otherRentalId}`)
      .set(authOwner())
      .expect(404);
  });

  it('booking dengan rental: happy path, amount = court + sewa + fee, snapshot tersimpan', async () => {
    const res = await request(app.getHttpServer())
      .post('/bookings')
      .set(authUser())
      .send({
        courtId,
        date: DATE,
        start: '08:00',
        rentals: [{ rentalId: rental1Id, qty: 2 }],
      })
      .expect(201);
    // Court 100000 + sewa 2x20000=40000 → subtotal 140000 + fee 2500.
    expect(res.body.subtotal).toBe(140000);
    expect(res.body.rentalsTotal).toBe(40000);
    expect(res.body.amount).toBe(142500);
    expect(res.body.serviceFee).toBe(2500);
    expect(res.body.rentals).toEqual([
      {
        rentalId: rental1Id,
        name: 'Bola futsal',
        price: 20000,
        qty: 2,
        subtotal: 40000,
      },
    ]);

    // Stok TIDAK di-decrement (cek saja): booking kedua qty sama tetap bisa.
    const again = await request(app.getHttpServer())
      .post('/bookings')
      .set(authUser())
      .send({
        courtId,
        date: DATE,
        start: '09:00',
        rentals: [{ rentalId: rental1Id, qty: 5 }],
      })
      .expect(201);
    expect(again.body.rentalsTotal).toBe(100000);
    expect(again.body.amount).toBe(202500);
  });

  it('booking dengan rental lintas venue -> 400', async () => {
    await request(app.getHttpServer())
      .post('/bookings')
      .set(authUser())
      .send({
        courtId,
        date: DATE,
        start: '10:00',
        rentals: [{ rentalId: otherRentalId, qty: 1 }],
      })
      .expect(400);
  });

  it('booking dengan rental stok kurang -> 409', async () => {
    await request(app.getHttpServer())
      .post('/bookings')
      .set(authUser())
      .send({
        courtId,
        date: DATE,
        start: '10:00',
        rentals: [{ rentalId: rental2Id, qty: 2 }],
      })
      .expect(409);
  });

  it('booking dengan rental inactive -> 409', async () => {
    await request(app.getHttpServer())
      .patch(`/venues/${venueId}/rentals/${rental2Id}`)
      .set(authOwner())
      .send({ status: 'inactive' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/bookings')
      .set(authUser())
      .send({
        courtId,
        date: DATE,
        start: '10:00',
        rentals: [{ rentalId: rental2Id, qty: 1 }],
      })
      .expect(409);

    await request(app.getHttpServer())
      .patch(`/venues/${venueId}/rentals/${rental2Id}`)
      .set(authOwner())
      .send({ status: 'active' })
      .expect(200);
  });

  it('booking tanpa rentals tetap jalan (rentals [], rentalsTotal 0)', async () => {
    const res = await request(app.getHttpServer())
      .post('/bookings')
      .set(authUser())
      .send({ courtId, date: DATE, start: '10:00' })
      .expect(201);
    expect(res.body.rentals).toEqual([]);
    expect(res.body.rentalsTotal).toBe(0);
    expect(res.body.amount).toBe(102500);
  });

  it('rentals: DELETE owner -> 204, item hilang dari katalog', async () => {
    await request(app.getHttpServer())
      .delete(`/venues/${venueId}/rentals/${rental2Id}`)
      .set(authOwner())
      .expect(204);

    const mine = await request(app.getHttpServer())
      .get(`/venues/${venueId}/rentals`)
      .set(authOwner())
      .expect(200);
    expect(mine.body.meta.total).toBe(1);

    // Booking yang sudah tersimpan menyimpan snapshot (tidak ikut hilang).
    const detail = await request(app.getHttpServer())
      .get('/bookings/me')
      .set(authUser())
      .expect(200);
    const withRental = (detail.body.data as Array<{ rentals: unknown[] }>).find(
      (b) => b.rentals.length > 0,
    );
    expect(withRental).toBeDefined();
  });

  afterAll(async () => {
    await app.close();
  });
});
