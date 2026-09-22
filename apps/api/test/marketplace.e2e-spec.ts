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

describe('Marketplace MP-01 (e2e)', () => {
  let app: INestApplication;
  let users: Repository<User>;
  const ts = Date.now();
  const password = 'Password123!';

  let sellerToken: string; // user biasa -> apply -> approve -> seller
  let seller2Token: string; // seller kedua (untuk 403 lintas seller)
  let plainToken: string; // user biasa tanpa profil seller
  let adminToken: string;

  let sellerId: string;
  let seller2Id: string;
  let productId: string; // milik seller1 (pending -> approved)
  let rejectedProductId: string;

  const authSeller = () => ({ Authorization: `Bearer ${sellerToken}` });
  const authSeller2 = () => ({ Authorization: `Bearer ${seller2Token}` });
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

    sellerToken = (
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: `mp01_seller_${ts}@example.com`, password })
        .expect(201)
    ).body.accessToken;

    seller2Token = (
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: `mp01_seller2_${ts}@example.com`, password })
        .expect(201)
    ).body.accessToken;

    plainToken = (
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: `mp01_plain_${ts}@example.com`, password })
        .expect(201)
    ).body.accessToken;

    const regAdmin = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `mp01_admin_${ts}@example.com`, password })
      .expect(201);
    await users.update({ id: regAdmin.body.user.id }, { role: 'super_admin' });
    adminToken = await login(`mp01_admin_${ts}@example.com`);
  });

  it('POST /sellers tanpa token -> 401', async () => {
    await request(app.getHttpServer())
      .post('/sellers')
      .send({ shopName: 'Toko Tanpa Token' })
      .expect(401);
  });

  it('onboarding: user biasa apply -> 201 pending, role tetap user', async () => {
    const res = await request(app.getHttpServer())
      .post('/sellers')
      .set(authSeller())
      .send({ shopName: 'Toko Sinar Jaya', description: 'Alat olahraga' })
      .expect(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.shopName).toBe('Toko Sinar Jaya');
    expect(res.body.status).toBe('pending');
    sellerId = res.body.id;

    const me = await request(app.getHttpServer())
      .get('/me')
      .set(authSeller())
      .expect(200);
    expect(me.body.role).toBe('user');
  });

  it('apply dua kali -> 409', async () => {
    await request(app.getHttpServer())
      .post('/sellers')
      .set(authSeller())
      .send({ shopName: 'Toko Lain' })
      .expect(409);
  });

  it('PATCH /sellers/me milik sendiri -> 200; tanpa profil -> 404', async () => {
    const res = await request(app.getHttpServer())
      .patch('/sellers/me')
      .set(authSeller())
      .send({ description: 'Alat olahraga lengkap' })
      .expect(200);
    expect(res.body.description).toBe('Alat olahraga lengkap');
    expect(res.body.status).toBe('pending');

    await request(app.getHttpServer())
      .patch('/sellers/me')
      .set(authPlain())
      .send({ description: 'x' })
      .expect(404);
  });

  it('GET /sellers/pending non-admin -> 403; admin -> 200 memuat pendaftar', async () => {
    await request(app.getHttpServer())
      .get('/sellers/pending')
      .set(authSeller())
      .expect(403);

    const res = await request(app.getHttpServer())
      .get('/sellers/pending')
      .set(authAdmin())
      .expect(200);
    const ids = (res.body as Array<{ id: string }>).map((s) => s.id);
    expect(ids).toContain(sellerId);
  });

  it('user biasa belum approved tidak bisa buat produk -> 403', async () => {
    await request(app.getHttpServer())
      .post('/products')
      .set(authSeller())
      .send({
        category: 'Sepatu',
        name: 'Sepatu Futsal X',
        price: 500000,
        stock: 10,
      })
      .expect(403);
  });

  it('admin approve seller -> approved + role jadi seller', async () => {
    const res = await request(app.getHttpServer())
      .post(`/sellers/${sellerId}/approve`)
      .set(authAdmin())
      .expect(201);
    expect(res.body.status).toBe('approved');

    sellerToken = await login(`mp01_seller_${ts}@example.com`);
    const me = await request(app.getHttpServer())
      .get('/me')
      .set(authSeller())
      .expect(200);
    expect(me.body.role).toBe('seller');
  });

  it('admin reject seller pending + reason -> rejected, role tetap user', async () => {
    const created = await request(app.getHttpServer())
      .post('/sellers')
      .set(authSeller2())
      .send({ shopName: 'Toko Ditolak' })
      .expect(201);
    seller2Id = created.body.id;

    const rejected = await request(app.getHttpServer())
      .post(`/sellers/${seller2Id}/reject`)
      .set(authAdmin())
      .send({ reason: 'Data tidak lengkap' })
      .expect(200);
    expect(rejected.body.status).toBe('rejected');
    expect(rejected.body.rejectionReason).toBe('Data tidak lengkap');

    const me = await request(app.getHttpServer())
      .get('/me')
      .set(authSeller2())
      .expect(200);
    expect(me.body.role).toBe('user');
  });

  it('approve seller non-pending -> 409', async () => {
    await request(app.getHttpServer())
      .post(`/sellers/${sellerId}/approve`)
      .set(authAdmin())
      .expect(409);
  });

  it('seller approved buat produk -> 201 pending; publik belum melihatnya', async () => {
    const res = await request(app.getHttpServer())
      .post('/products')
      .set(authSeller())
      .send({
        category: 'Sepatu',
        name: 'Sepatu Futsal Pro',
        description: 'Ringan dan awet',
        price: 750000,
        stock: 5,
        photos: ['https://cdn.example.com/p1.jpg'],
      })
      .expect(201);
    expect(res.body.status).toBe('pending');
    expect(res.body.price).toBe(750000);
    expect(res.body.stock).toBe(5);
    productId = res.body.id;

    const list = await request(app.getHttpServer()).get('/products').expect(200);
    expect(
      (list.body.data as Array<{ id: string }>).map((p) => p.id),
    ).not.toContain(productId);
    await request(app.getHttpServer()).get(`/products/${productId}`).expect(404);
  });

  it('owner bisa lihat produk pending miliknya; admin bisa; user lain 404', async () => {
    const mine = await request(app.getHttpServer())
      .get(`/products/${productId}`)
      .set(authSeller())
      .expect(200);
    expect(mine.body.id).toBe(productId);

    await request(app.getHttpServer())
      .get(`/products/${productId}`)
      .set(authAdmin())
      .expect(200);

    await request(app.getHttpServer())
      .get(`/products/${productId}`)
      .set(authPlain())
      .expect(404);
  });

  it('produk pending masuk antrean admin; approve -> tampil publik', async () => {
    const pending = await request(app.getHttpServer())
      .get('/products/pending')
      .set(authAdmin())
      .expect(200);
    expect(
      (pending.body as Array<{ id: string }>).map((p) => p.id),
    ).toContain(productId);

    const approved = await request(app.getHttpServer())
      .post(`/products/${productId}/approve`)
      .set(authAdmin())
      .expect(201);
    expect(approved.body.status).toBe('approved');

    const detail = await request(app.getHttpServer())
      .get(`/products/${productId}`)
      .expect(200);
    expect(detail.body.status).toBe('approved');

    const list = await request(app.getHttpServer()).get('/products').expect(200);
    expect(
      (list.body.data as Array<{ id: string }>).map((p) => p.id),
    ).toContain(productId);
  });

  it('filter: search, category, seller, pagination', async () => {
    const second = await request(app.getHttpServer())
      .post('/products')
      .set(authSeller())
      .send({
        category: 'Raket',
        name: `Raket Badminton ${ts}`,
        description: 'Tension tinggi',
        price: 350000,
        stock: 3,
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/products/${second.body.id}/approve`)
      .set(authAdmin())
      .expect(201);

    const search = await request(app.getHttpServer())
      .get('/products')
      .query({ search: 'futsal' })
      .expect(200);
    expect(
      (search.body.data as Array<{ id: string }>).map((p) => p.id),
    ).toContain(productId);

    const cat = await request(app.getHttpServer())
      .get('/products')
      .query({ category: 'raket' })
      .expect(200);
    expect(
      (cat.body.data as Array<{ id: string }>).map((p) => p.id),
    ).toContain(second.body.id);
    expect(
      (cat.body.data as Array<{ id: string }>).map((p) => p.id),
    ).not.toContain(productId);

    const bySeller = await request(app.getHttpServer())
      .get('/products')
      .query({ seller: sellerId })
      .expect(200);
    expect(bySeller.body.meta.total).toBeGreaterThanOrEqual(2);

    const page = await request(app.getHttpServer())
      .get('/products')
      .query({ page: 1, limit: 1 })
      .expect(200);
    expect(page.body.data.length).toBeLessThanOrEqual(1);
    expect(page.body.meta).toMatchObject({ page: 1, limit: 1 });
  });

  it('403 lintas seller: PATCH produk milik seller lain', async () => {
    // seller2 (rejected) tidak punya akses; jadikan approved dulu via apply ulang? tidak bisa (sudah ada profil).
    // Pakai user plain yang di-approve sebagai seller kedua.
    const created = await request(app.getHttpServer())
      .post('/sellers')
      .set(authPlain())
      .send({ shopName: 'Toko Kedua' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/sellers/${created.body.id}/approve`)
      .set(authAdmin())
      .expect(201);
    plainToken = await login(`mp01_plain_${ts}@example.com`);

    await request(app.getHttpServer())
      .patch(`/products/${productId}`)
      .set(authPlain())
      .send({ price: 1 })
      .expect(403);
  });

  it('PATCH sensitif atas produk approved -> 202 CR; publik tetap lama sampai admin approve', async () => {
    const updated = await request(app.getHttpServer())
      .patch(`/products/${productId}`)
      .set(authSeller())
      .send({ price: 800000, stock: 7 })
      .expect(202);
    expect(updated.body.pendingReview).toBe(true);
    expect(updated.body.changeRequestId).toBeDefined();

    // publik tetap harga lama selama CR pending
    const pub = await request(app.getHttpServer())
      .get(`/products/${productId}`)
      .expect(200);
    expect(pub.body.price).toBe(750000);
    expect(pub.body.status).toBe('approved');

    await request(app.getHttpServer())
      .post(`/admin/change-requests/${updated.body.changeRequestId}/approve`)
      .set(authAdmin())
      .expect(201);

    const after = await request(app.getHttpServer())
      .get(`/products/${productId}`)
      .expect(200);
    expect(after.body.price).toBe(800000);
    expect(after.body.stock).toBe(7);
    expect(after.body.status).toBe('approved');
  });

  it('admin reject produk pending + reason -> rejected, tersembunyi publik', async () => {
    const created = await request(app.getHttpServer())
      .post('/products')
      .set(authSeller())
      .send({
        category: 'Bola',
        name: 'Bola Tak Lolos',
        price: 100000,
        stock: 2,
      })
      .expect(201);
    rejectedProductId = created.body.id;

    const rejected = await request(app.getHttpServer())
      .post(`/products/${rejectedProductId}/reject`)
      .set(authAdmin())
      .send({ reason: 'Foto tidak jelas' })
      .expect(200);
    expect(rejected.body.status).toBe('rejected');
    expect(rejected.body.rejectionReason).toBe('Foto tidak jelas');

    await request(app.getHttpServer())
      .get(`/products/${rejectedProductId}`)
      .expect(404);
  });

  it('validasi: harga negatif -> 400; tanpa nama -> 400', async () => {
    await request(app.getHttpServer())
      .post('/products')
      .set(authSeller())
      .send({ category: 'Bola', name: 'Bola X', price: -1, stock: 1 })
      .expect(400);
    await request(app.getHttpServer())
      .post('/products')
      .set(authSeller())
      .send({ category: 'Bola', name: '', price: 1000, stock: 1 })
      .expect(400);
  });

  it('non-admin approve produk -> 403; tanpa token buat produk -> 401', async () => {
    await request(app.getHttpServer())
      .post(`/products/${productId}/approve`)
      .set(authSeller())
      .expect(403);
    await request(app.getHttpServer())
      .post('/products')
      .send({ category: 'Bola', name: 'Bola Y', price: 1000, stock: 1 })
      .expect(401);
  });

  afterAll(async () => {
    await app.close();
  });
});
