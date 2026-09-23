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

describe('Voucher + Poin Kawan ST-04 (e2e)', () => {
  let app: INestApplication;
  let users: Repository<User>;
  const ts = Date.now();
  const password = 'Password123!';

  let adminToken: string;
  let ownerToken: string;
  let buyerToken: string;
  let buyer2Token: string;
  let sellerToken: string;
  let venueId: string;
  let courtId: string;
  let productId: string;

  const DATE = '2030-07-15';
  const OPEN = {
    mon: ['08:00-18:00'],
    tue: ['08:00-18:00'],
    wed: ['08:00-18:00'],
    thu: ['08:00-18:00'],
    fri: ['08:00-18:00'],
    sat: ['08:00-18:00'],
    sun: ['08:00-18:00'],
  };

  const authAdmin = () => ({ Authorization: `Bearer ${adminToken}` });
  const authBuyer = () => ({ Authorization: `Bearer ${buyerToken}` });
  const authBuyer2 = () => ({ Authorization: `Bearer ${buyer2Token}` });

  const login = async (email: string) =>
    (
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(200)
    ).body.accessToken as string;

  const mePoints = async (auth: Record<string, string>) =>
    (
      await request(app.getHttpServer()).get('/me').set(auth).expect(200)
    ).body.loyaltyPoints as number;

  function bookNotif(booking: { paymentRef: string; amount: number }) {
    const statusCode = '200';
    const grossAmount = String(booking.amount);
    return {
      order_id: booking.paymentRef,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: sign(booking.paymentRef, statusCode, grossAmount),
      transaction_status: 'settlement',
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

    const regAdmin = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `st04_admin_${ts}@example.com`, password })
      .expect(201);
    await users.update({ id: regAdmin.body.user.id }, { role: 'super_admin' });
    adminToken = await login(`st04_admin_${ts}@example.com`);

    const regOwner = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `st04_owner_${ts}@example.com`, password })
      .expect(201);
    await users.update({ id: regOwner.body.user.id }, { role: 'venue_owner' });
    ownerToken = await login(`st04_owner_${ts}@example.com`);

    buyerToken = (
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: `st04_buyer_${ts}@example.com`, password })
        .expect(201)
    ).body.accessToken;
    buyer2Token = (
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: `st04_buyer2_${ts}@example.com`, password })
        .expect(201)
    ).body.accessToken;

    const venue = await request(app.getHttpServer())
      .post('/venues')
      .set({ Authorization: `Bearer ${ownerToken}` })
      .send({
        name: 'GOR ST04',
        address: 'Jl. Promo No. 4',
        lat: -6.2,
        lng: 106.8,
        sports: ['Futsal'],
      })
      .expect(201);
    venueId = venue.body.id;

    const court = await request(app.getHttpServer())
      .post(`/venues/${venueId}/courts`)
      .set({ Authorization: `Bearer ${ownerToken}` })
      .send({
        sport: 'Futsal',
        name: 'Lapangan Promo',
        pricePerHour: 100000,
        openHours: OPEN,
      })
      .expect(201);
    courtId = court.body.id;

    // Seller + produk approved untuk path checkout.
    const regSeller = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `st04_seller_${ts}@example.com`, password })
      .expect(201);
    const sellerRegToken = regSeller.body.accessToken as string;
    const seller = await request(app.getHttpServer())
      .post('/sellers')
      .set({ Authorization: `Bearer ${sellerRegToken}` })
      .send({ shopName: 'Toko ST04' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/sellers/${seller.body.id}/approve`)
      .set(authAdmin())
      .expect(201);
    sellerToken = await login(`st04_seller_${ts}@example.com`);
    const product = await request(app.getHttpServer())
      .post('/products')
      .set({ Authorization: `Bearer ${sellerToken}` })
      .send({ category: 'Bola', name: 'Bola ST04', price: 60000, stock: 20 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/products/${product.body.id}/approve`)
      .set(authAdmin())
      .expect(201);
    productId = product.body.id;
  });

  it('admin voucher: non-admin -> 403 semua', async () => {
    await request(app.getHttpServer())
      .post('/admin/vouchers')
      .set(authBuyer())
      .send({ code: 'X', type: 'fixed', value: 1000 })
      .expect(403);
    await request(app.getHttpServer())
      .get('/admin/vouchers')
      .set(authBuyer())
      .expect(403);
    await request(app.getHttpServer())
      .patch('/admin/vouchers/00000000-0000-0000-0000-000000000000')
      .set(authBuyer())
      .send({ value: 1 })
      .expect(403);
    await request(app.getHttpServer())
      .post('/admin/vouchers/00000000-0000-0000-0000-000000000000/deactivate')
      .set(authBuyer())
      .expect(403);
  });

  it('admin voucher: create validasi (percent >100 -> 400, duplikat -> 409)', async () => {
    await request(app.getHttpServer())
      .post('/admin/vouchers')
      .set(authAdmin())
      .send({ code: 'BADPCT', type: 'percent', value: 150 })
      .expect(400);

    await request(app.getHttpServer())
      .post('/admin/vouchers')
      .set(authAdmin())
      .send({ code: 'V10PCT', type: 'percent', value: 10 })
      .expect(201);

    await request(app.getHttpServer())
      .post('/admin/vouchers')
      .set(authAdmin())
      .send({ code: 'v10pct', type: 'fixed', value: 1000 })
      .expect(409);

    const mk = (body: Record<string, unknown>) =>
      request(app.getHttpServer())
        .post('/admin/vouchers')
        .set(authAdmin())
        .send(body)
        .expect(201);
    await mk({ code: 'V50MAX', type: 'percent', value: 50, maxDiscount: 30000 });
    await mk({ code: 'VFIXED', type: 'fixed', value: 25000, applicableTo: 'booking' });
    await mk({ code: 'VSHOP', type: 'fixed', value: 10000, applicableTo: 'shop' });
    await mk({ code: 'VEXP', type: 'fixed', value: 5000, validTo: '2020-01-01T00:00:00.000Z' });
    await mk({ code: 'VMIN', type: 'fixed', value: 5000, minTransaction: 200000 });
    await mk({ code: 'VQ1', type: 'fixed', value: 5000, quota: 1, perUserLimit: 1 });

    const list = await request(app.getHttpServer())
      .get('/admin/vouchers')
      .set(authAdmin())
      .expect(200);
    expect(list.body.meta.total).toBeGreaterThanOrEqual(7);
    const codes = (list.body.data as Array<{ code: string }>).map((v) => v.code);
    for (const c of ['V10PCT', 'V50MAX', 'VFIXED', 'VSHOP', 'VEXP', 'VMIN', 'VQ1']) {
      expect(codes).toContain(c);
    }
  });

  it('booking dgn voucher percent valid -> diskon benar + snapshot', async () => {
    const res = await request(app.getHttpServer())
      .post('/bookings')
      .set(authBuyer())
      .send({ courtId, date: DATE, start: '08:00', voucherCode: 'v10pct' })
      .expect(201);
    expect(res.body.subtotal).toBe(100000);
    expect(res.body.discount).toBe(10000);
    expect(res.body.voucherCode).toBe('V10PCT');
    expect(res.body.pointsUsed).toBe(0);
    expect(res.body.amount).toBe(90000);
  });

  it('booking percent capped maxDiscount -> 30000 (bukan 50000)', async () => {
    const res = await request(app.getHttpServer())
      .post('/bookings')
      .set(authBuyer())
      .send({ courtId, date: DATE, start: '09:00', voucherCode: 'V50MAX' })
      .expect(201);
    expect(res.body.discount).toBe(30000);
    expect(res.body.amount).toBe(70000);
  });

  it('booking voucher invalid: unknown/expired/min/scope -> 400', async () => {
    await request(app.getHttpServer())
      .post('/bookings')
      .set(authBuyer())
      .send({ courtId, date: DATE, start: '10:00', voucherCode: 'NOTEXIST' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/bookings')
      .set(authBuyer())
      .send({ courtId, date: DATE, start: '10:00', voucherCode: 'VEXP' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/bookings')
      .set(authBuyer())
      .send({ courtId, date: DATE, start: '10:00', voucherCode: 'VMIN' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/bookings')
      .set(authBuyer())
      .send({ courtId, date: DATE, start: '10:00', voucherCode: 'VSHOP' })
      .expect(400);
  });

  it('booking voucher kuota 1: pakai pertama OK, kedua -> 409', async () => {
    const first = await request(app.getHttpServer())
      .post('/bookings')
      .set(authBuyer())
      .send({ courtId, date: DATE, start: '10:00', voucherCode: 'VQ1' })
      .expect(201);
    expect(first.body.discount).toBe(5000);
    expect(first.body.amount).toBe(95000);

    await request(app.getHttpServer())
      .post('/bookings')
      .set(authBuyer())
      .send({ courtId, date: DATE, start: '11:00', voucherCode: 'VQ1' })
      .expect(409);
    await request(app.getHttpServer())
      .post('/bookings')
      .set(authBuyer2())
      .send({ courtId, date: DATE, start: '11:00', voucherCode: 'VQ1' })
      .expect(409);
  });

  it('admin: PATCH code voucher terpakai -> 409; deactivate -> redeem 400', async () => {
    const list = await request(app.getHttpServer())
      .get('/admin/vouchers')
      .set(authAdmin())
      .expect(200);
    const vq1 = (list.body.data as Array<{ code: string; id: string }>).find(
      (v) => v.code === 'VQ1',
    )!;
    await request(app.getHttpServer())
      .patch(`/admin/vouchers/${vq1.id}`)
      .set(authAdmin())
      .send({ code: 'VQ1NEW' })
      .expect(409);

    const vmin = (list.body.data as Array<{ code: string; id: string }>).find(
      (v) => v.code === 'VMIN',
    )!;
    const patched = await request(app.getHttpServer())
      .patch(`/admin/vouchers/${vmin.id}`)
      .set(authAdmin())
      .send({ minTransaction: 50000 })
      .expect(200);
    expect(patched.body.minTransaction).toBe(50000);

    await request(app.getHttpServer())
      .post(`/admin/vouchers/${vmin.id}/deactivate`)
      .set(authAdmin())
      .expect(200);
    await request(app.getHttpServer())
      .post('/bookings')
      .set(authBuyer())
      .send({ courtId, date: DATE, start: '11:00', voucherCode: 'VMIN' })
      .expect(400);
  });

  it('poin: review -> +50; update review TIDAK nambah; /me memuat loyaltyPoints', async () => {
    expect(await mePoints(authBuyer())).toBe(0);
    const created = await request(app.getHttpServer())
      .post('/ratings')
      .set(authBuyer())
      .send({ venueId, score: 5, comment: 'Mantap!' })
      .expect(201);
    expect(await mePoints(authBuyer())).toBe(50);

    await request(app.getHttpServer())
      .put(`/ratings/${created.body.id}`)
      .set(authBuyer())
      .send({ score: 4, comment: 'Update ulasan' })
      .expect(200);
    expect(await mePoints(authBuyer())).toBe(50);
  });

  it('booking pakai poin melebihi saldo -> 400; negatif -> 400', async () => {
    await request(app.getHttpServer())
      .post('/bookings')
      .set(authBuyer())
      .send({ courtId, date: DATE, start: '11:00', usePoints: 1000 })
      .expect(400);
    await request(app.getHttpServer())
      .post('/bookings')
      .set(authBuyer())
      .send({ courtId, date: DATE, start: '11:00', usePoints: -5 })
      .expect(400);
  });

  it('booking voucher+poin: subtotal -> diskon -> poin -> total; webhook final -> paid', async () => {
    const res = await request(app.getHttpServer())
      .post('/bookings')
      .set(authBuyer())
      .send({
        courtId,
        date: DATE,
        start: '11:00',
        voucherCode: 'VFIXED',
        usePoints: 50,
      })
      .expect(201);
    expect(res.body.subtotal).toBe(100000);
    expect(res.body.discount).toBe(25000);
    expect(res.body.pointsUsed).toBe(50);
    expect(res.body.amount).toBe(74950);
    expect(await mePoints(authBuyer())).toBe(0);

    // Webhook dgn nominal lama (pre-diskon) -> 409, tetap pending.
    const statusCode = '200';
    const wrong = String(100000);
    await request(app.getHttpServer())
      .post('/payments/midtrans/notification')
      .send({
        order_id: res.body.paymentRef,
        status_code: statusCode,
        gross_amount: wrong,
        signature_key: sign(res.body.paymentRef, statusCode, wrong),
        transaction_status: 'settlement',
      })
      .expect(409);

    const paid = await request(app.getHttpServer())
      .post('/payments/midtrans/notification')
      .send(bookNotif(res.body))
      .expect(200);
    expect(paid.body.status).toBe('paid');

    const detail = await request(app.getHttpServer())
      .get(`/bookings/${res.body.id}`)
      .set(authBuyer())
      .expect(200);
    expect(detail.body.discount).toBe(25000);
    expect(detail.body.voucherCode).toBe('VFIXED');
    expect(detail.body.pointsUsed).toBe(50);
    expect(detail.body.status).toBe('paid');
  });

  it('checkout voucher+poin: snapshot benar; webhook final -> paid', async () => {
    // buyer2 earn 50 poin via review.
    await request(app.getHttpServer())
      .post('/ratings')
      .set(authBuyer2())
      .send({ venueId, score: 5, comment: 'Bagus!' })
      .expect(201);
    expect(await mePoints(authBuyer2())).toBe(50);

    // Voucher scope booking tidak berlaku di shop -> 400.
    await request(app.getHttpServer())
      .put('/cart')
      .set(authBuyer2())
      .send({ productId, qty: 2 })
      .expect(200);
    await request(app.getHttpServer())
      .post('/checkout')
      .set(authBuyer2())
      .send({ voucherCode: 'VFIXED' })
      .expect(400);

    const res = await request(app.getHttpServer())
      .post('/checkout')
      .set(authBuyer2())
      .send({ voucherCode: 'VSHOP', usePoints: 30 })
      .expect(201);
    expect(res.body.subtotal).toBe(120000);
    expect(res.body.discount).toBe(10000);
    expect(res.body.voucherCode).toBe('VSHOP');
    expect(res.body.pointsUsed).toBe(30);
    expect(res.body.total).toBe(109970);
    expect(await mePoints(authBuyer2())).toBe(20);

    const statusCode = '200';
    const grossAmount = String(res.body.total);
    const paid = await request(app.getHttpServer())
      .post('/payments/midtrans/notification')
      .send({
        order_id: res.body.paymentRef,
        status_code: statusCode,
        gross_amount: grossAmount,
        signature_key: sign(res.body.paymentRef, statusCode, grossAmount),
        transaction_status: 'settlement',
      })
      .expect(200);
    expect(paid.body.status).toBe('paid');

    const detail = await request(app.getHttpServer())
      .get(`/orders/${res.body.id}`)
      .set(authBuyer2())
      .expect(200);
    expect(detail.body.status).toBe('paid');
    expect(detail.body.discount).toBe(10000);
    expect(detail.body.pointsUsed).toBe(30);
  });

  it('checkout poin melebihi saldo -> 400 dan cart utuh', async () => {
    await request(app.getHttpServer())
      .put('/cart')
      .set(authBuyer2())
      .send({ productId, qty: 1 })
      .expect(200);
    await request(app.getHttpServer())
      .post('/checkout')
      .set(authBuyer2())
      .send({ usePoints: 99999 })
      .expect(400);
    const cart = await request(app.getHttpServer())
      .get('/cart')
      .set(authBuyer2())
      .expect(200);
    expect(cart.body.items).toHaveLength(1);
    expect(await mePoints(authBuyer2())).toBe(20);
    await request(app.getHttpServer())
      .put('/cart')
      .set(authBuyer2())
      .send({ clear: true })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });
});
