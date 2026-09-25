process.env.DB_DRIVER = 'sqljs';
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '7d';
process.env.MIDTRANS_SERVER_KEY = '';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Product } from '../src/marketplace/product.entity';
import { User } from '../src/users/user.entity';

describe('Marketplace ST-05 varian + badge + verified + fulfillment (e2e)', () => {
  let app: INestApplication;
  let users: Repository<User>;
  let products: Repository<Product>;
  const ts = Date.now();
  const password = 'Password123!';

  let adminToken: string;
  let sellerToken: string;
  let buyerToken: string;
  let sellerId: string;
  let varProductId: string; // varian: S (stock 2), XL (+50rb, tanpa stok)
  let plainProductId: string; // tanpa varian

  const authAdmin = () => ({ Authorization: `Bearer ${adminToken}` });
  const authSeller = () => ({ Authorization: `Bearer ${sellerToken}` });
  const authBuyer = () => ({ Authorization: `Bearer ${buyerToken}` });

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
    products = app.get<Repository<Product>>(getRepositoryToken(Product));

    const regAdmin = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `st05_admin_${ts}@example.com`, password })
      .expect(201);
    await users.update({ id: regAdmin.body.user.id }, { role: 'super_admin' });
    adminToken = await login(`st05_admin_${ts}@example.com`);

    sellerToken = (
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: `st05_seller_${ts}@example.com`, password })
        .expect(201)
    ).body.accessToken;
    const created = await request(app.getHttpServer())
      .post('/sellers')
      .set(authSeller())
      .send({ shopName: 'Toko Varian' })
      .expect(201);
    sellerId = created.body.id;
    expect(created.body.verified).toBe(false);
    await request(app.getHttpServer())
      .post(`/sellers/${sellerId}/approve`)
      .set(authAdmin())
      .expect(201);
    sellerToken = await login(`st05_seller_${ts}@example.com`);

    buyerToken = (
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: `st05_buyer_${ts}@example.com`, password })
        .expect(201)
    ).body.accessToken;

    const vp = await request(app.getHttpServer())
      .post('/products')
      .set(authSeller())
      .send({
        category: 'Jersey',
        name: 'Jersey Lari Pro',
        price: 200000,
        stock: 10,
        badge: 'baru',
        variants: [
          { name: 'S', priceDelta: 0, stock: 2 },
          { name: 'XL', priceDelta: 50000 },
        ],
      })
      .expect(201);
    expect(vp.body.badge).toBe('baru');
    expect(vp.body.variants).toHaveLength(2);
    varProductId = vp.body.id;
    await request(app.getHttpServer())
      .post(`/products/${varProductId}/approve`)
      .set(authAdmin())
      .expect(201);

    const pp = await request(app.getHttpServer())
      .post('/products')
      .set(authSeller())
      .send({ category: 'Bola', name: 'Bola Polos', price: 50000, stock: 5 })
      .expect(201);
    plainProductId = pp.body.id;
    expect(pp.body.variants).toEqual([]);
    expect(pp.body.badge).toBeNull();
    await request(app.getHttpServer())
      .post(`/products/${plainProductId}/approve`)
      .set(authAdmin())
      .expect(201);
  });

  it('validasi varian: >10 varian -> 400; badge asing -> 400', async () => {
    const many = Array.from({ length: 11 }, (_, i) => ({ name: `V${i}` }));
    await request(app.getHttpServer())
      .post('/products')
      .set(authSeller())
      .send({ category: 'X', name: 'Kebanyakan', price: 1000, stock: 1, variants: many })
      .expect(400);
    await request(app.getHttpServer())
      .post('/products')
      .set(authSeller())
      .send({ category: 'X', name: 'Badge Asing', price: 1000, stock: 1, badge: 'top' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/products')
      .set(authSeller())
      .send({
        category: 'X',
        name: 'Varian Rusak',
        price: 1000,
        stock: 1,
        variants: [{ name: '', priceDelta: 1.5 }],
      })
      .expect(400);
  });

  it('POST /sellers/:id/verify: non-admin -> 403; admin -> 200 verified', async () => {
    await request(app.getHttpServer())
      .post(`/sellers/${sellerId}/verify`)
      .set(authSeller())
      .expect(403);
    const res = await request(app.getHttpServer())
      .post(`/sellers/${sellerId}/verify`)
      .set(authAdmin())
      .expect(200);
    expect(res.body.verified).toBe(true);
    // Idempotent: verifikasi ulang tetap 200.
    await request(app.getHttpServer())
      .post(`/sellers/${sellerId}/verify`)
      .set(authAdmin())
      .expect(200);
    await request(app.getHttpServer())
      .post('/sellers/00000000-0000-0000-0000-000000000000/verify')
      .set(authAdmin())
      .expect(404);
  });

  it('verified tampil di payload produk (seller.verified)', async () => {
    const detail = await request(app.getHttpServer())
      .get(`/products/${varProductId}`)
      .expect(200);
    expect(detail.body.seller.verified).toBe(true);
    expect(detail.body.badge).toBe('baru');
    expect(detail.body.variants).toHaveLength(2);
  });

  it('PUT /cart varian: indeks valid -> baris per varian; invalid -> 400', async () => {
    // Varian S (index 0): harga dasar 200rb.
    let res = await request(app.getHttpServer())
      .put('/cart')
      .set(authBuyer())
      .send({ productId: varProductId, qty: 1, variantIndex: 0 })
      .expect(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].variantIndex).toBe(0);
    expect(res.body.items[0].variantName).toBe('S');
    expect(res.body.items[0].product.price).toBe(200000);

    // Varian XL (index 1): 200rb + 50rb.
    res = await request(app.getHttpServer())
      .put('/cart')
      .set(authBuyer())
      .send({ productId: varProductId, qty: 1, variantIndex: 1 })
      .expect(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.total).toBe(450000);

    // Indeks di luar rentang -> 400.
    await request(app.getHttpServer())
      .put('/cart')
      .set(authBuyer())
      .send({ productId: varProductId, qty: 1, variantIndex: 7 })
      .expect(400);
    // Produk tanpa varian + variantIndex -> 400.
    await request(app.getHttpServer())
      .put('/cart')
      .set(authBuyer())
      .send({ productId: plainProductId, qty: 1, variantIndex: 0 })
      .expect(400);

    await request(app.getHttpServer())
      .put('/cart')
      .set(authBuyer())
      .send({ clear: true })
      .expect(200);
  });

  it('checkout fulfillment: pickup + fee -> 400; delivery fee >100rb -> 400', async () => {
    await request(app.getHttpServer())
      .put('/cart')
      .set(authBuyer())
      .send({ productId: plainProductId, qty: 1 })
      .expect(200);
    await request(app.getHttpServer())
      .post('/checkout')
      .set(authBuyer())
      .send({ fulfillment: 'pickup', deliveryFee: 5000 })
      .expect(400);
    await request(app.getHttpServer())
      .post('/checkout')
      .set(authBuyer())
      .send({ fulfillment: 'delivery', deliveryFee: 150000 })
      .expect(400);
    await request(app.getHttpServer())
      .put('/cart')
      .set(authBuyer())
      .send({ clear: true })
      .expect(200);
  });

  it('checkout delivery: total = barang + ongkir, snapshot fulfillment/fee', async () => {
    await request(app.getHttpServer())
      .put('/cart')
      .set(authBuyer())
      .send({ productId: plainProductId, qty: 1 })
      .expect(200);
    const res = await request(app.getHttpServer())
      .post('/checkout')
      .set(authBuyer())
      .send({ fulfillment: 'delivery', deliveryFee: 10000 })
      .expect(201);
    expect(res.body.fulfillment).toBe('delivery');
    expect(res.body.deliveryFee).toBe(10000);
    expect(res.body.subtotal).toBe(50000);
    expect(res.body.total).toBe(60000);

    const detail = await request(app.getHttpServer())
      .get(`/orders/${res.body.id}`)
      .set(authBuyer())
      .expect(200);
    expect(detail.body.fulfillment).toBe('delivery');
    expect(detail.body.deliveryFee).toBe(10000);
  });

  it('checkout varian: harga + delta, stok varian decrement, base utuh', async () => {
    await request(app.getHttpServer())
      .put('/cart')
      .set(authBuyer())
      .send({ productId: varProductId, qty: 2, variantIndex: 0 })
      .expect(200);
    const res = await request(app.getHttpServer())
      .post('/checkout')
      .set(authBuyer())
      .expect(201);
    expect(res.body.fulfillment).toBe('pickup');
    expect(res.body.deliveryFee).toBe(0);
    expect(res.body.total).toBe(400000);
    const item = res.body.groups[0].items[0];
    expect(item.variantIndex).toBe(0);
    expect(item.variantName).toBe('S');
    expect(item.price).toBe(200000);

    const p = await products.findOneOrFail({ where: { id: varProductId } });
    expect(p.variants?.[0]?.stock).toBe(0);
    expect(p.stock).toBe(10); // stok dasar tidak tersentuh

    // Stok varian habis -> 409, stok tidak berubah.
    await request(app.getHttpServer())
      .put('/cart')
      .set(authBuyer())
      .send({ productId: varProductId, qty: 1, variantIndex: 0 })
      .expect(200);
    await request(app.getHttpServer())
      .post('/checkout')
      .set(authBuyer())
      .expect(409);
    const p2 = await products.findOneOrFail({ where: { id: varProductId } });
    expect(p2.variants?.[0]?.stock).toBe(0);
    await request(app.getHttpServer())
      .put('/cart')
      .set(authBuyer())
      .send({ clear: true })
      .expect(200);
  });

  it('checkout varian tanpa stok memakai stok dasar + rollback webhook', async () => {
    await request(app.getHttpServer())
      .put('/cart')
      .set(authBuyer())
      .send({ productId: varProductId, qty: 1, variantIndex: 1 })
      .expect(200);
    const res = await request(app.getHttpServer())
      .post('/checkout')
      .set(authBuyer())
      .expect(201);
    expect(res.body.total).toBe(250000); // 200rb + 50rb delta
    const p = await products.findOneOrFail({ where: { id: varProductId } });
    expect(p.stock).toBe(9);

    // Expire -> rollback ke stok dasar (varian XL tanpa stok sendiri).
    const { createHash } = await import('crypto');
    const gross = String(res.body.total);
    const sig = createHash('sha512')
      .update(`${res.body.paymentRef}200${gross}`)
      .digest('hex');
    await request(app.getHttpServer())
      .post('/payments/midtrans/notification')
      .send({
        order_id: res.body.paymentRef,
        status_code: '200',
        gross_amount: gross,
        signature_key: sig,
        transaction_status: 'expire',
      })
      .expect(200);
    const p2 = await products.findOneOrFail({ where: { id: varProductId } });
    expect(p2.stock).toBe(10);
  });

  afterAll(async () => {
    await app.close();
  });
});
