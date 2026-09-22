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

/**
 * AD-02: edit-butuh-approve (change requests) + CMS approval (API).
 * - Owner edit field sensitif atas entity APPROVED -> 202 pending + CR id,
 *   publik tetap data lama.
 * - Admin approve -> payload live; reject -> tetap lama + reason.
 * - Admin / entity non-approved -> langsung ubah seperti sebelumnya.
 */
describe('Change requests AD-02 (e2e)', () => {
  let app: INestApplication;
  let users: Repository<User>;
  const ts = Date.now();
  const password = 'Password123!';

  let ownerToken: string;
  let sellerToken: string;
  let plainToken: string;
  let adminToken: string;

  let venueId: string;
  let courtId: string;
  let productId: string;

  const authOwner = () => ({ Authorization: `Bearer ${ownerToken}` });
  const authSeller = () => ({ Authorization: `Bearer ${sellerToken}` });
  const authPlain = () => ({ Authorization: `Bearer ${plainToken}` });
  const authAdmin = () => ({ Authorization: `Bearer ${adminToken}` });

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
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    users = app.get<Repository<User>>(getRepositoryToken(User));

    // venue_owner
    const regOwner = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `ad02_owner_${ts}@example.com`, password })
      .expect(201);
    await users.update({ id: regOwner.body.user.id }, { role: 'venue_owner' });
    ownerToken = await login(`ad02_owner_${ts}@example.com`);

    // seller (apply -> approve agar bisa buat produk)
    sellerToken = (
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: `ad02_seller_${ts}@example.com`, password })
        .expect(201)
    ).body.accessToken;
    const sellerProfile = await request(app.getHttpServer())
      .post('/sellers')
      .set(authSeller())
      .send({ shopName: 'Toko AD02' })
      .expect(201);

    plainToken = (
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: `ad02_plain_${ts}@example.com`, password })
        .expect(201)
    ).body.accessToken;

    const regAdmin = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `ad02_admin_${ts}@example.com`, password })
      .expect(201);
    await users.update({ id: regAdmin.body.user.id }, { role: 'super_admin' });
    adminToken = await login(`ad02_admin_${ts}@example.com`);

    await request(app.getHttpServer())
      .post(`/sellers/${sellerProfile.body.id}/approve`)
      .set(authAdmin())
      .expect(201);
    sellerToken = await login(`ad02_seller_${ts}@example.com`);

    // venue approved milik owner
    const venue = await request(app.getHttpServer())
      .post('/venues')
      .set(authOwner())
      .send({
        name: 'GOR AD02',
        address: 'Jl. AD02 No. 1',
        lat: -6.2,
        lng: 106.8,
        sports: ['Futsal'],
        photos: ['https://cdn.example.com/ad02.jpg'],
      })
      .expect(201);
    venueId = venue.body.id;
    await request(app.getHttpServer())
      .post(`/venues/${venueId}/approve`)
      .set(authAdmin())
      .expect(201);

    // court milik venue approved
    const court = await request(app.getHttpServer())
      .post(`/venues/${venueId}/courts`)
      .set(authOwner())
      .send({
        sport: 'Futsal',
        name: 'Lapangan AD02',
        pricePerHour: 100000,
        openHours: { mon: ['08:00-22:00'] },
      })
      .expect(201);
    courtId = court.body.id;

    // produk approved milik seller
    const product = await request(app.getHttpServer())
      .post('/products')
      .set(authSeller())
      .send({
        category: 'Sepatu',
        name: 'Sepatu AD02',
        description: 'Awal',
        price: 500000,
        stock: 10,
      })
      .expect(201);
    productId = product.body.id;
    await request(app.getHttpServer())
      .post(`/products/${productId}/approve`)
      .set(authAdmin())
      .expect(201);
  });

  it('owner edit nama venue approved -> 202 pending; publik tetap nama lama', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/venues/${venueId}`)
      .set(authOwner())
      .send({ name: 'GOR AD02 Baru' })
      .expect(202);
    expect(res.body.pendingReview).toBe(true);
    expect(res.body.changeRequestId).toBeDefined();
    expect(res.body.entityType).toBe('venue');
    expect(res.body.entityId).toBe(venueId);

    const pub = await request(app.getHttpServer())
      .get(`/venues/${venueId}`)
      .expect(200);
    expect(pub.body.name).toBe('GOR AD02');
    expect(pub.body.status).toBe('approved');

    const mine = await request(app.getHttpServer())
      .get('/me/change-requests')
      .set(authOwner())
      .expect(200);
    const ids = (mine.body.data as Array<{ id: string }>).map((c) => c.id);
    expect(ids).toContain(res.body.changeRequestId);

    const queue = await request(app.getHttpServer())
      .get('/admin/change-requests')
      .query({ status: 'pending' })
      .set(authAdmin())
      .expect(200);
    expect(
      (queue.body.data as Array<{ id: string }>).map((c) => c.id),
    ).toContain(res.body.changeRequestId);

    const approved = await request(app.getHttpServer())
      .post(`/admin/change-requests/${res.body.changeRequestId}/approve`)
      .set(authAdmin())
      .expect(201);
    expect(approved.body.status).toBe('approved');

    const after = await request(app.getHttpServer())
      .get(`/venues/${venueId}`)
      .expect(200);
    expect(after.body.name).toBe('GOR AD02 Baru');
    expect(after.body.updatedBy).toBeDefined();
  });

  it('owner edit harga court venue-approved -> 202; reject -> tetap lama + reason', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/venues/${venueId}/courts/${courtId}`)
      .set(authOwner())
      .send({ pricePerHour: 999000 })
      .expect(202);
    expect(res.body.entityType).toBe('court');

    const pub = await request(app.getHttpServer())
      .get(`/venues/${venueId}`)
      .expect(200);
    expect(pub.body.courts[0].pricePerHour).toBe(100000);

    const rejected = await request(app.getHttpServer())
      .post(`/admin/change-requests/${res.body.changeRequestId}/reject`)
      .set(authAdmin())
      .send({ reason: 'Harga tidak wajar' })
      .expect(200);
    expect(rejected.body.status).toBe('rejected');
    expect(rejected.body.reason).toBe('Harga tidak wajar');

    const still = await request(app.getHttpServer())
      .get(`/venues/${venueId}`)
      .expect(200);
    expect(still.body.courts[0].pricePerHour).toBe(100000);

    // CR yang sudah direview tidak bisa di-approve lagi -> 409
    await request(app.getHttpServer())
      .post(`/admin/change-requests/${res.body.changeRequestId}/approve`)
      .set(authAdmin())
      .expect(409);
  });

  it('seller edit harga produk approved -> 202 pending; approve -> harga baru live', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/products/${productId}`)
      .set(authSeller())
      .send({ price: 650000 })
      .expect(202);
    expect(res.body.entityType).toBe('product');

    const pub = await request(app.getHttpServer())
      .get(`/products/${productId}`)
      .expect(200);
    expect(pub.body.price).toBe(500000);
    expect(pub.body.status).toBe('approved');

    await request(app.getHttpServer())
      .post(`/admin/change-requests/${res.body.changeRequestId}/approve`)
      .set(authAdmin())
      .expect(201);

    const after = await request(app.getHttpServer())
      .get(`/products/${productId}`)
      .expect(200);
    expect(after.body.price).toBe(650000);
    expect(after.body.status).toBe('approved');
  });

  it('admin edit langsung entity approved -> 200 tanpa CR', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/venues/${venueId}`)
      .set(authAdmin())
      .send({ address: 'Jl. Admin Langsung No. 9' })
      .expect(200);
    expect(res.body.pendingReview).toBeUndefined();
    expect(res.body.address).toBe('Jl. Admin Langsung No. 9');

    const prod = await request(app.getHttpServer())
      .patch(`/products/${productId}`)
      .set(authAdmin())
      .send({ price: 660000 })
      .expect(200);
    expect(prod.body.price).toBe(660000);
  });

  it('owner edit entity non-approved -> 200 langsung (tanpa CR)', async () => {
    const draft = await request(app.getHttpServer())
      .post('/venues')
      .set(authOwner())
      .send({
        name: 'GOR Draft AD02',
        address: 'Jl. Draft',
        lat: -6.21,
        lng: 106.81,
        sports: ['Basket'],
      })
      .expect(201);
    expect(draft.body.status).toBe('pending');

    const res = await request(app.getHttpServer())
      .patch(`/venues/${draft.body.id}`)
      .set(authOwner())
      .send({ name: 'GOR Draft AD02 Revisi' })
      .expect(200);
    expect(res.body.pendingReview).toBeUndefined();
    expect(res.body.name).toBe('GOR Draft AD02 Revisi');
  });

  it('edit non-sensitif (stok) atas produk approved -> 200 langsung, tetap approved', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/products/${productId}`)
      .set(authSeller())
      .send({ stock: 42 })
      .expect(200);
    expect(res.body.stock).toBe(42);
    expect(res.body.status).toBe('approved');

    const pub = await request(app.getHttpServer())
      .get(`/products/${productId}`)
      .expect(200);
    expect(pub.body.stock).toBe(42);
  });

  it('auth: tanpa token /me/change-requests -> 401; non-admin /admin/change-requests -> 403', async () => {
    await request(app.getHttpServer()).get('/me/change-requests').expect(401);
    await request(app.getHttpServer())
      .get('/admin/change-requests')
      .set(authPlain())
      .expect(403);
    await request(app.getHttpServer())
      .get('/admin/change-requests')
      .set(authOwner())
      .expect(403);
  });

  it('admin lists read-only: venues/products/sellers/users/bookings/orders', async () => {
    const venues = await request(app.getHttpServer())
      .get('/admin/venues')
      .query({ status: 'approved' })
      .set(authAdmin())
      .expect(200);
    expect(
      (venues.body.data as Array<{ id: string }>).map((v) => v.id),
    ).toContain(venueId);

    const products = await request(app.getHttpServer())
      .get('/admin/products')
      .query({ status: 'approved' })
      .set(authAdmin())
      .expect(200);
    expect(
      (products.body.data as Array<{ id: string }>).map((p) => p.id),
    ).toContain(productId);

    const sellers = await request(app.getHttpServer())
      .get('/admin/sellers')
      .query({ status: 'approved' })
      .set(authAdmin())
      .expect(200);
    expect(sellers.body.length).toBeGreaterThanOrEqual(1);

    const usersRes = await request(app.getHttpServer())
      .get('/admin/users')
      .query({ role: 'venue_owner' })
      .set(authAdmin())
      .expect(200);
    expect(usersRes.body.meta.total).toBeGreaterThanOrEqual(1);

    await request(app.getHttpServer())
      .get('/admin/bookings')
      .set(authAdmin())
      .expect(200);
    await request(app.getHttpServer())
      .get('/admin/orders')
      .set(authAdmin())
      .expect(200);

    // non-admin tidak boleh
    await request(app.getHttpServer())
      .get('/admin/venues')
      .set(authOwner())
      .expect(403);
  });

  afterAll(async () => {
    await app.close();
  });
});
