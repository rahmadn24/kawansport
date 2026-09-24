process.env.DB_DRIVER = 'sqljs';
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '7d';
// Paksa mode stub Midtrans (tanpa network/key): signature dihitung dengan key kosong.
process.env.MIDTRANS_SERVER_KEY = '';

import { createHash } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { User } from '../src/users/user.entity';

function sign(orderId: string, statusCode: string, grossAmount: string): string {
  return createHash('sha512')
    .update(`${orderId}${statusCode}${grossAmount}`)
    .digest('hex');
}

describe('Seller dashboard toko: GET /products/mine + GET /orders/seller (e2e)', () => {
  let app: INestApplication;
  let users: Repository<User>;
  const ts = Date.now();
  const password = 'Password123!';

  let adminToken: string;
  let sellerAToken: string;
  let sellerBToken: string;
  let sellerCToken: string; // approved, tanpa produk & tanpa order
  let plainToken: string; // tanpa profil seller
  let buyerToken: string;

  const buyerEmail = `sdash_buyer_${ts}@example.com`;
  const buyerDisplayName = 'Budi Pembeli';

  let shopA = '';
  let shopB = '';
  let approvedAId = '';
  let pendingAId = '';
  let rejectedAId = '';
  let approvedBId = '';
  const priceA = 100000;
  const priceB = 50000;

  const authAdmin = () => ({ Authorization: `Bearer ${adminToken}` });
  const authA = () => ({ Authorization: `Bearer ${sellerAToken}` });
  const authB = () => ({ Authorization: `Bearer ${sellerBToken}` });
  const authC = () => ({ Authorization: `Bearer ${sellerCToken}` });
  const authPlain = () => ({ Authorization: `Bearer ${plainToken}` });
  const authBuyer = () => ({ Authorization: `Bearer ${buyerToken}` });

  const login = async (email: string) =>
    (
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(200)
    ).body.accessToken as string;

  async function makeSeller(email: string, shop: string): Promise<string> {
    const reg = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password })
      .expect(201);
    const token = reg.body.accessToken as string;
    const created = await request(app.getHttpServer())
      .post('/sellers')
      .set({ Authorization: `Bearer ${token}` })
      .send({ shopName: shop })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/sellers/${created.body.id}/approve`)
      .set(authAdmin())
      .expect(201);
    return login(email);
  }

  async function makeProduct(
    token: string,
    body: Record<string, unknown>,
    approve: boolean,
  ): Promise<string> {
    const created = await request(app.getHttpServer())
      .post('/products')
      .set({ Authorization: `Bearer ${token}` })
      .send(body)
      .expect(201);
    const id = created.body.id as string;
    if (approve) {
      await request(app.getHttpServer())
        .post(`/products/${id}/approve`)
        .set(authAdmin())
        .expect(201);
    }
    return id;
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

    const regAdmin = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `sdash_admin_${ts}@example.com`, password })
      .expect(201);
    await users.update({ id: regAdmin.body.user.id }, { role: 'super_admin' });
    adminToken = await login(`sdash_admin_${ts}@example.com`);

    shopA = `Toko Dash A ${ts}`;
    shopB = `Toko Dash B ${ts}`;
    sellerAToken = await makeSeller(`sdash_sa_${ts}@example.com`, shopA);
    sellerBToken = await makeSeller(`sdash_sb_${ts}@example.com`, shopB);
    sellerCToken = await makeSeller(
      `sdash_sc_${ts}@example.com`,
      `Toko Dash C ${ts}`,
    );

    plainToken = (
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: `sdash_plain_${ts}@example.com`, password })
        .expect(201)
    ).body.accessToken;

    buyerToken = (
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: buyerEmail, password, displayName: buyerDisplayName })
        .expect(201)
    ).body.accessToken;

    // Produk seller A: satu approved, satu pending, satu rejected.
    approvedAId = await makeProduct(
      sellerAToken,
      { category: 'Sepatu', name: 'Sepatu Dash Approved', price: priceA, stock: 5 },
      true,
    );
    pendingAId = await makeProduct(
      sellerAToken,
      { category: 'Sepatu', name: 'Sepatu Dash Pending', price: 75000, stock: 4 },
      false,
    );
    rejectedAId = await makeProduct(
      sellerAToken,
      { category: 'Topi', name: 'Topi Dash Rejected', price: 25000, stock: 2 },
      false,
    );
    await request(app.getHttpServer())
      .post(`/products/${rejectedAId}/reject`)
      .set(authAdmin())
      .send({ reason: 'Foto tidak jelas' })
      .expect(200);

    // Produk seller B (approved) — tidak boleh bocor ke mine milik A.
    approvedBId = await makeProduct(
      sellerBToken,
      { category: 'Bola', name: 'Bola Dash B', price: priceB, stock: 6 },
      true,
    );
  });

  it('tanpa token -> 401 (kedua endpoint)', async () => {
    await request(app.getHttpServer()).get('/products/mine').expect(401);
    await request(app.getHttpServer()).get('/orders/seller').expect(401);
  });

  it('tanpa profil seller -> 404 jujur (bukan array kosong)', async () => {
    const mine = await request(app.getHttpServer())
      .get('/products/mine')
      .set(authPlain())
      .expect(404);
    expect(String(mine.body.message ?? '')).toMatch(/Belum punya toko/);

    const seller = await request(app.getHttpServer())
      .get('/orders/seller')
      .set(authPlain())
      .expect(404);
    expect(String(seller.body.message ?? '')).toMatch(/Belum punya toko/);
  });

  it('GET /products/mine: semua status milik sendiri + meta, lintas seller tak bocor', async () => {
    const res = await request(app.getHttpServer())
      .get('/products/mine')
      .set(authA())
      .expect(200);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 20, total: 3 });
    const ids = (res.body.data as Array<{ id: string }>).map((p) => p.id);
    expect(ids).toEqual(
      expect.arrayContaining([approvedAId, pendingAId, rejectedAId]),
    );
    expect(ids).not.toContain(approvedBId);

    const byId = new Map(
      (res.body.data as Array<{ id: string; status: string }>).map((p) => [
        p.id,
        p.status,
      ]),
    );
    expect(byId.get(approvedAId)).toBe('approved');
    expect(byId.get(pendingAId)).toBe('pending');
    expect(byId.get(rejectedAId)).toBe('rejected');

    // Shape = ProductItem yang sama (seller + status + rejectionReason).
    const approved = (res.body.data as Array<Record<string, unknown>>).find(
      (p) => p.id === approvedAId,
    )!;
    expect(approved).toMatchObject({
      name: 'Sepatu Dash Approved',
      price: priceA,
      stock: 5,
      status: 'approved',
    });
    expect(approved.seller).toMatchObject({ shopName: shopA });

    // Publik tetap hanya approved.
    const pub = await request(app.getHttpServer()).get('/products').expect(200);
    const pubIds = (pub.body.data as Array<{ id: string }>).map((p) => p.id);
    expect(pubIds).toContain(approvedAId);
    expect(pubIds).not.toContain(pendingAId);
    expect(pubIds).not.toContain(rejectedAId);

    // Mine milik B hanya produk B.
    const mineB = await request(app.getHttpServer())
      .get('/products/mine')
      .set(authB())
      .expect(200);
    expect(mineB.body.meta.total).toBe(1);
    expect(
      (mineB.body.data as Array<{ id: string }>).map((p) => p.id),
    ).toEqual([approvedBId]);
  });

  it('GET /products/mine pagination page/limit', async () => {
    const res = await request(app.getHttpServer())
      .get('/products/mine')
      .query({ page: 1, limit: 2 })
      .set(authA())
      .expect(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 2, total: 3 });

    const res2 = await request(app.getHttpServer())
      .get('/products/mine')
      .query({ page: 2, limit: 2 })
      .set(authA())
      .expect(200);
    expect(res2.body.data).toHaveLength(1);
    expect(res2.body.meta).toMatchObject({ page: 2, limit: 2, total: 3 });
  });

  it('GET /orders/seller: grup milik sendiri benar, buyer hanya displayName', async () => {
    // Buyer checkout multiseller: 1x produk A + 2x produk B.
    await request(app.getHttpServer())
      .put('/cart')
      .set(authBuyer())
      .send({ productId: approvedAId, qty: 1 })
      .expect(200);
    await request(app.getHttpServer())
      .put('/cart')
      .set(authBuyer())
      .send({ productId: approvedBId, qty: 2 })
      .expect(200);
    const checkout = await request(app.getHttpServer())
      .post('/checkout')
      .set(authBuyer())
      .expect(201);
    const orderId = checkout.body.id as string;
    const paymentRef = checkout.body.paymentRef as string;
    expect(paymentRef).toMatch(/^MP-/);

    // Seller A hanya melihat grupnya.
    const resA = await request(app.getHttpServer())
      .get('/orders/seller')
      .set(authA())
      .expect(200);
    expect(resA.body.meta.total).toBe(1);
    const gA = resA.body.data[0];
    expect(gA).toMatchObject({
      orderId,
      paymentRef,
      status: 'pending',
      subtotal: priceA * 1,
      sellerShopName: shopA,
      buyerDisplayName,
    });
    expect(gA.groupId).toBeDefined();
    expect(gA.paidAt).toBeNull();
    expect(gA.createdAt).toBeDefined();
    expect(gA.items).toHaveLength(1);
    expect(gA.items[0]).toMatchObject({
      productId: approvedAId,
      productName: 'Sepatu Dash Approved',
      qty: 1,
      price: priceA,
      subtotal: priceA,
    });

    // Buyer TIDAK bocor: tanpa email/telepon di mana pun pada response.
    const rawA = JSON.stringify(resA.body);
    expect(rawA).not.toContain(buyerEmail);
    expect(rawA).not.toContain('@example.com');
    expect(rawA.toLowerCase()).not.toContain('phone');
    expect(Object.keys(gA)).toEqual(
      expect.arrayContaining([
        'groupId',
        'orderId',
        'paymentRef',
        'status',
        'subtotal',
        'sellerShopName',
        'items',
        'buyerDisplayName',
        'paidAt',
        'createdAt',
      ]),
    );

    // Seller B hanya melihat grupnya (subtotal 2x harga B).
    const resB = await request(app.getHttpServer())
      .get('/orders/seller')
      .set(authB())
      .expect(200);
    expect(resB.body.meta.total).toBe(1);
    expect(resB.body.data[0]).toMatchObject({
      orderId,
      paymentRef,
      status: 'pending',
      subtotal: priceB * 2,
      sellerShopName: shopB,
      buyerDisplayName,
    });
    expect(resB.body.data[0].groupId).not.toBe(gA.groupId);

    // Webhook settlement -> status grup ikut order induk (paid).
    const statusCode = '200';
    const grossAmount = String(checkout.body.total);
    await request(app.getHttpServer())
      .post('/payments/midtrans/notification')
      .send({
        order_id: paymentRef,
        status_code: statusCode,
        gross_amount: grossAmount,
        signature_key: sign(paymentRef, statusCode, grossAmount),
        transaction_status: 'settlement',
      })
      .expect(200);
    const paidA = await request(app.getHttpServer())
      .get('/orders/seller')
      .set(authA())
      .expect(200);
    expect(paidA.body.data[0].status).toBe('paid');
    expect(paidA.body.data[0].paidAt).not.toBeNull();
  });

  it('seller tanpa order -> data kosong; tanpa produk -> mine kosong', async () => {
    const empty = await request(app.getHttpServer())
      .get('/orders/seller')
      .set(authC())
      .expect(200);
    expect(empty.body.data).toEqual([]);
    expect(empty.body.meta).toMatchObject({ total: 0 });

    const mineC = await request(app.getHttpServer())
      .get('/products/mine')
      .set(authC())
      .expect(200);
    expect(mineC.body.data).toEqual([]);
    expect(mineC.body.meta).toMatchObject({ total: 0 });
  });

  afterAll(async () => {
    await app.close();
  });
});
