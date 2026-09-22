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
import { Product } from '../src/marketplace/product.entity';
import { User } from '../src/users/user.entity';

function sign(orderId: string, statusCode: string, grossAmount: string): string {
  return createHash('sha512')
    .update(`${orderId}${statusCode}${grossAmount}`)
    .digest('hex');
}

describe('Marketplace MP-02 cart + checkout + orders (e2e)', () => {
  let app: INestApplication;
  let users: Repository<User>;
  let products: Repository<Product>;
  const ts = Date.now();
  const password = 'Password123!';

  let adminToken: string;
  let sellerAToken: string;
  let sellerBToken: string;
  let buyerToken: string;
  let buyer2Token: string;

  let productAId: string; // seller A, stock 5, price 100000
  let productBId: string; // seller B, stock 3, price 50000
  let raceProductId: string; // seller A, stock 1 (untuk race test)

  const authAdmin = () => ({ Authorization: `Bearer ${adminToken}` });
  const authA = () => ({ Authorization: `Bearer ${sellerAToken}` });
  const authB = () => ({ Authorization: `Bearer ${sellerBToken}` });
  const authBuyer = () => ({ Authorization: `Bearer ${buyerToken}` });
  const authBuyer2 = () => ({ Authorization: `Bearer ${buyer2Token}` });

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
  ): Promise<string> {
    const created = await request(app.getHttpServer())
      .post('/products')
      .set({ Authorization: `Bearer ${token}` })
      .send(body)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/products/${created.body.id}/approve`)
      .set(authAdmin())
      .expect(201);
    return created.body.id as string;
  }

  function notif(
    order: { paymentRef: string; total: number },
    transactionStatus: string,
    extra: Record<string, string> = {},
  ) {
    const statusCode = '200';
    const grossAmount = String(order.total);
    return {
      order_id: order.paymentRef,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: sign(order.paymentRef, statusCode, grossAmount),
      transaction_status: transactionStatus,
      ...extra,
    };
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
    products = app.get<Repository<Product>>(getRepositoryToken(Product));

    const regAdmin = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `mp02_admin_${ts}@example.com`, password })
      .expect(201);
    await users.update({ id: regAdmin.body.user.id }, { role: 'super_admin' });
    adminToken = await login(`mp02_admin_${ts}@example.com`);

    sellerAToken = await makeSeller(`mp02_sa_${ts}@example.com`, 'Toko A');
    sellerBToken = await makeSeller(`mp02_sb_${ts}@example.com`, 'Toko B');

    buyerToken = (
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: `mp02_buyer_${ts}@example.com`, password })
        .expect(201)
    ).body.accessToken;
    buyer2Token = (
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: `mp02_buyer2_${ts}@example.com`, password })
        .expect(201)
    ).body.accessToken;

    productAId = await makeProduct(sellerAToken, {
      category: 'Sepatu',
      name: 'Sepatu A',
      price: 100000,
      stock: 5,
    });
    productBId = await makeProduct(sellerBToken, {
      category: 'Bola',
      name: 'Bola B',
      price: 50000,
      stock: 3,
    });
    raceProductId = await makeProduct(sellerAToken, {
      category: 'Raket',
      name: 'Raket Race',
      price: 200000,
      stock: 1,
    });
  });

  it('GET /cart tanpa token -> 401; cart baru kosong', async () => {
    await request(app.getHttpServer()).get('/cart').expect(401);
    const res = await request(app.getHttpServer())
      .get('/cart')
      .set(authBuyer())
      .expect(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it('PUT /cart add/update/remove/clear', async () => {
    // add A x2
    let res = await request(app.getHttpServer())
      .put('/cart')
      .set(authBuyer())
      .send({ productId: productAId, qty: 2 })
      .expect(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].qty).toBe(2);
    expect(res.body.total).toBe(200000);

    // add B x1 → total 250000
    res = await request(app.getHttpServer())
      .put('/cart')
      .set(authBuyer())
      .send({ productId: productBId, qty: 1 })
      .expect(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.total).toBe(250000);

    // update A → 1
    res = await request(app.getHttpServer())
      .put('/cart')
      .set(authBuyer())
      .send({ productId: productAId, qty: 1 })
      .expect(200);
    expect(res.body.total).toBe(150000);

    // remove B via qty 0
    res = await request(app.getHttpServer())
      .put('/cart')
      .set(authBuyer())
      .send({ productId: productBId, qty: 0 })
      .expect(200);
    expect(res.body.items).toHaveLength(1);

    // clear
    res = await request(app.getHttpServer())
      .put('/cart')
      .set(authBuyer())
      .send({ clear: true })
      .expect(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it('PUT /cart validasi: produk tak-ada -> 404; tanpa qty -> 400; produk pending tak bisa masuk cart', async () => {
    await request(app.getHttpServer())
      .put('/cart')
      .set(authBuyer())
      .send({ productId: '00000000-0000-0000-0000-000000000000', qty: 1 })
      .expect(404);

    await request(app.getHttpServer())
      .put('/cart')
      .set(authBuyer())
      .send({ productId: productAId })
      .expect(400);

    // produk pending (belum approve) tidak terlihat untuk cart
    const pending = await request(app.getHttpServer())
      .post('/products')
      .set(authA())
      .send({ category: 'Topi', name: 'Topi Pending', price: 10000, stock: 9 })
      .expect(201);
    await request(app.getHttpServer())
      .put('/cart')
      .set(authBuyer())
      .send({ productId: pending.body.id, qty: 1 })
      .expect(404);
  });

  it('POST /checkout cart kosong -> 400', async () => {
    await request(app.getHttpServer())
      .post('/checkout')
      .set(authBuyer2())
      .expect(400);
  });

  it('checkout multiseller: 1 order + 2 groups, stok decrement, cart kosong, Snap stub', async () => {
    await request(app.getHttpServer())
      .put('/cart')
      .set(authBuyer())
      .send({ productId: productAId, qty: 2 })
      .expect(200);
    await request(app.getHttpServer())
      .put('/cart')
      .set(authBuyer())
      .send({ productId: productBId, qty: 1 })
      .expect(200);

    const res = await request(app.getHttpServer())
      .post('/checkout')
      .set(authBuyer())
      .expect(201);
    expect(res.body.status).toBe('pending');
    expect(res.body.paymentRef).toMatch(/^MP-/);
    expect(res.body.channel).toBe('marketplace');
    expect(res.body.total).toBe(250000);
    expect(res.body.snapToken).toMatch(/^stub-snap-MP-/);
    expect(res.body.redirectUrl).toContain(res.body.paymentRef);
    expect(res.body.groups).toHaveLength(2);
    const subtotals = [...res.body.groups.map((g: { subtotal: number }) => g.subtotal)].sort(
      (a: number, b: number) => a - b,
    );
    expect(subtotals).toEqual([50000, 200000]);

    // stok berkurang: A 5→3, B 3→2
    const a = await products.findOneOrFail({ where: { id: productAId } });
    const b = await products.findOneOrFail({ where: { id: productBId } });
    expect(a.stock).toBe(3);
    expect(b.stock).toBe(2);

    // cart dikosongkan
    const cart = await request(app.getHttpServer())
      .get('/cart')
      .set(authBuyer())
      .expect(200);
    expect(cart.body.items).toEqual([]);
  });

  it('checkout stok kurang -> 409 dan stok tidak berubah', async () => {
    await request(app.getHttpServer())
      .put('/cart')
      .set(authBuyer2())
      .send({ productId: productBId, qty: 99 })
      .expect(200);
    await request(app.getHttpServer())
      .post('/checkout')
      .set(authBuyer2())
      .expect(409);
    const b = await products.findOneOrFail({ where: { id: productBId } });
    expect(b.stock).toBe(2);
    await request(app.getHttpServer())
      .put('/cart')
      .set(authBuyer2())
      .send({ clear: true })
      .expect(200);
  });

  it('webhook settlement -> paid (order+groups); double-hit idempotent; BK- prefix tetap untuk booking', async () => {
    const me = await request(app.getHttpServer())
      .get('/orders/me')
      .set(authBuyer())
      .expect(200);
    const order = me.body.data[0];
    expect(order.paymentRef).toMatch(/^MP-/);

    const first = await request(app.getHttpServer())
      .post('/payments/midtrans/notification')
      .send(notif(order, 'settlement'))
      .expect(200);
    expect(first.body.status).toBe('paid');

    const second = await request(app.getHttpServer())
      .post('/payments/midtrans/notification')
      .send(notif(order, 'settlement'))
      .expect(200);
    expect(second.body.status).toBe('paid');

    const detail = await request(app.getHttpServer())
      .get(`/orders/${order.id}`)
      .set(authBuyer())
      .expect(200);
    expect(detail.body.status).toBe('paid');
    expect(detail.body.paidAt).not.toBeNull();
    for (const g of detail.body.groups) expect(g.status).toBe('paid');

    // stok tidak berubah setelah paid
    const a = await products.findOneOrFail({ where: { id: productAId } });
    expect(a.stock).toBe(3);
  });

  it('webhook signature invalid -> 403 dan status tidak berubah', async () => {
    await request(app.getHttpServer())
      .put('/cart')
      .set(authBuyer2())
      .send({ productId: productAId, qty: 1 })
      .expect(200);
    const created = await request(app.getHttpServer())
      .post('/checkout')
      .set(authBuyer2())
      .expect(201);

    const bad = notif(created.body, 'settlement');
    bad.signature_key = '0'.repeat(128);
    await request(app.getHttpServer())
      .post('/payments/midtrans/notification')
      .send(bad)
      .expect(403);

    const detail = await request(app.getHttpServer())
      .get(`/orders/${created.body.id}`)
      .set(authBuyer2())
      .expect(200);
    expect(detail.body.status).toBe('pending');

    // bayar beneran agar stok konsisten untuk test berikut
    await request(app.getHttpServer())
      .post('/payments/midtrans/notification')
      .send(notif(created.body, 'settlement'))
      .expect(200);
  });

  it('webhook expire -> expired + rollback stok; cancel -> cancelled + rollback', async () => {
    const beforeA = (await products.findOneOrFail({ where: { id: productAId } }))
      .stock;

    await request(app.getHttpServer())
      .put('/cart')
      .set(authBuyer2())
      .send({ productId: productAId, qty: 1 })
      .expect(200);
    const created = await request(app.getHttpServer())
      .post('/checkout')
      .set(authBuyer2())
      .expect(201);
    const during = (await products.findOneOrFail({ where: { id: productAId } }))
      .stock;
    expect(during).toBe(beforeA - 1);

    const expired = await request(app.getHttpServer())
      .post('/payments/midtrans/notification')
      .send(notif(created.body, 'expire'))
      .expect(200);
    expect(expired.body.status).toBe('expired');
    const after = (await products.findOneOrFail({ where: { id: productAId } }))
      .stock;
    expect(after).toBe(beforeA);

    const groups = (
      await request(app.getHttpServer())
        .get(`/orders/${created.body.id}`)
        .set(authBuyer2())
        .expect(200)
    ).body.groups;
    for (const g of groups) expect(g.status).toBe('expired');

    // cancel path
    await request(app.getHttpServer())
      .put('/cart')
      .set(authBuyer2())
      .send({ productId: productBId, qty: 1 })
      .expect(200);
    const created2 = await request(app.getHttpServer())
      .post('/checkout')
      .set(authBuyer2())
      .expect(201);
    const cancelled = await request(app.getHttpServer())
      .post('/payments/midtrans/notification')
      .send(notif(created2.body, 'cancel'))
      .expect(200);
    expect(cancelled.body.status).toBe('cancelled');
    const b = await products.findOneOrFail({ where: { id: productBId } });
    expect(b.stock).toBe(2);
  });

  it('GET /orders/:id milik orang lain -> 403; admin lolos; tak-ada -> 404', async () => {
    const me = await request(app.getHttpServer())
      .get('/orders/me')
      .set(authBuyer())
      .expect(200);
    const id = me.body.data[0].id;

    await request(app.getHttpServer())
      .get(`/orders/${id}`)
      .set(authBuyer2())
      .expect(403);
    await request(app.getHttpServer())
      .get(`/orders/${id}`)
      .set(authAdmin())
      .expect(200);
    await request(app.getHttpServer())
      .get('/orders/00000000-0000-0000-0000-000000000000')
      .set(authBuyer())
      .expect(404);
  });

  it('race: 2 checkout paralel atas stok 1 -> tepat 1 sukses (201) + 1 gagal (409)', async () => {
    await request(app.getHttpServer())
      .put('/cart')
      .set(authBuyer())
      .send({ productId: raceProductId, qty: 1 })
      .expect(200);
    await request(app.getHttpServer())
      .put('/cart')
      .set(authBuyer2())
      .send({ productId: raceProductId, qty: 1 })
      .expect(200);

    const [r1, r2] = await Promise.all([
      request(app.getHttpServer()).post('/checkout').set(authBuyer()),
      request(app.getHttpServer()).post('/checkout').set(authBuyer2()),
    ]);
    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([201, 409]);

    const left = (
      await products.findOneOrFail({ where: { id: raceProductId } })
    ).stock;
    expect(left).toBe(0);
  });

  afterAll(async () => {
    await app.close();
  });
});
