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

describe('Payout & withdraw mitra API-W08 (e2e)', () => {
  let app: INestApplication;
  let users: Repository<User>;
  const ts = Date.now();
  const password = 'Password123!';

  let adminToken: string;
  let ownerToken: string;
  let owner2Token: string;
  let sellerToken: string;
  let plainToken: string;
  let venueId: string;
  let venue2Id: string;
  let courtId: string;
  let sellerId: string;

  const DATE = '2031-05-10';
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

  const authAdmin = () => ({ Authorization: `Bearer ${adminToken}` });
  const authOwner = () => ({ Authorization: `Bearer ${ownerToken}` });
  const authOwner2 = () => ({ Authorization: `Bearer ${owner2Token}` });
  const authSeller = () => ({ Authorization: `Bearer ${sellerToken}` });

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
      .send({ email: `po_admin_${ts}@example.com`, password })
      .expect(201);
    await users.update({ id: regAdmin.body.user.id }, { role: 'super_admin' });
    adminToken = await login(`po_admin_${ts}@example.com`);

    // Owner A + venue + court (100rb/jam).
    const ownerEmail = `po_owner_${ts}@example.com`;
    const regOwner = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: ownerEmail, password })
      .expect(201);
    await users.update({ id: regOwner.body.user.id }, { role: 'venue_owner' });
    ownerToken = await login(ownerEmail);

    const venue = await request(app.getHttpServer())
      .post('/venues')
      .set(authOwner())
      .send({
        name: 'GOR Payout',
        address: 'Jl. Payout No. 8',
        lat: -6.2,
        lng: 106.8,
        sports: ['Futsal'],
      })
      .expect(201);
    venueId = venue.body.id;
    const court = await request(app.getHttpServer())
      .post(`/venues/${venueId}/courts`)
      .set(authOwner())
      .send({
        sport: 'Futsal',
        name: 'Lapangan Payout',
        pricePerHour: 100000,
        openHours: ALL_DAYS_OPEN,
      })
      .expect(201);
    courtId = court.body.id;

    // Owner B + venue sendiri (untuk uji lintas owner).
    const owner2Email = `po_owner2_${ts}@example.com`;
    const regOwner2 = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: owner2Email, password })
      .expect(201);
    await users.update(
      { id: regOwner2.body.user.id },
      { role: 'venue_owner' },
    );
    owner2Token = await login(owner2Email);
    const venue2 = await request(app.getHttpServer())
      .post('/venues')
      .set(authOwner2())
      .send({
        name: 'GOR Payout Lain',
        address: 'Jl. Lain No. 9',
        lat: -6.3,
        lng: 106.9,
        sports: ['Futsal'],
      })
      .expect(201);
    venue2Id = venue2.body.id;

    // Seller (approve) + produk approved (50rb).
    const sellerEmail = `po_seller_${ts}@example.com`;
    const regSeller = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: sellerEmail, password })
      .expect(201);
    const sellerToken0 = regSeller.body.accessToken as string;
    const created = await request(app.getHttpServer())
      .post('/sellers')
      .set({ Authorization: `Bearer ${sellerToken0}` })
      .send({ shopName: 'Toko Payout' })
      .expect(201);
    sellerId = created.body.id;
    await request(app.getHttpServer())
      .post(`/sellers/${sellerId}/approve`)
      .set(authAdmin())
      .expect(201);
    sellerToken = await login(sellerEmail);
    const product = await request(app.getHttpServer())
      .post('/products')
      .set(authSeller())
      .send({ category: 'Bola', name: 'Bola Payout', price: 50000, stock: 10 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/products/${product.body.id}/approve`)
      .set(authAdmin())
      .expect(201);

    plainToken = (
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: `po_plain_${ts}@example.com`, password })
        .expect(201)
    ).body.accessToken as string;

    // Fixture pendapatan venue: 2 walk-in paid @100rb → gross 200rb.
    await request(app.getHttpServer())
      .post('/bookings/walk-in')
      .set(authOwner())
      .send({ courtId, date: DATE, start: '08:00', buyerName: 'A' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/bookings/walk-in')
      .set(authOwner())
      .send({ courtId, date: DATE, start: '09:00', buyerName: 'B' })
      .expect(201);

    // Fixture pendapatan seller: checkout 2×50rb → webhook settlement → paid.
    await request(app.getHttpServer())
      .put('/cart')
      .set({ Authorization: `Bearer ${plainToken}` })
      .send({ productId: product.body.id, qty: 2 })
      .expect(200);
    const order = await request(app.getHttpServer())
      .post('/checkout')
      .set({ Authorization: `Bearer ${plainToken}` })
      .expect(201);
    const statusCode = '200';
    const grossAmount = String(order.body.total);
    await request(app.getHttpServer())
      .post('/payments/midtrans/notification')
      .send({
        order_id: order.body.paymentRef,
        status_code: statusCode,
        gross_amount: grossAmount,
        signature_key: sign(order.body.paymentRef, statusCode, grossAmount),
        transaction_status: 'settlement',
      })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });

  it('tanpa token -> 401; user biasa -> 403', async () => {
    await request(app.getHttpServer()).get('/payouts/balance').expect(401);
    await request(app.getHttpServer())
      .post('/payouts')
      .set({ Authorization: `Bearer ${plainToken}` })
      .send({ payeeType: 'venue', payeeId: venueId, amount: 1000 })
      .expect(403);
    await request(app.getHttpServer())
      .get('/payouts')
      .set(authOwner())
      .expect(403);
  });

  it('saldo venue benar vs fixture (gross 200rb, komisi 5% → net 190rb)', async () => {
    const res = await request(app.getHttpServer())
      .get('/payouts/balance')
      .set(authOwner())
      .query({ payeeType: 'venue', payeeId: venueId })
      .expect(200);
    expect(res.body).toMatchObject({
      payeeType: 'venue',
      payeeId: venueId,
      gross: 200000,
      commissionPercent: 5,
      net: 190000,
      reserved: 0,
      available: 190000,
    });
  });

  it('saldo seller benar vs fixture (gross 100rb → net 95rb)', async () => {
    const res = await request(app.getHttpServer())
      .get('/payouts/balance')
      .set(authSeller())
      .query({ payeeType: 'seller', payeeId: sellerId })
      .expect(200);
    expect(res.body).toMatchObject({
      payeeType: 'seller',
      payeeId: sellerId,
      gross: 100000,
      commissionPercent: 5,
      net: 95000,
      reserved: 0,
      available: 95000,
    });
  });

  it('saldo agregat tanpa query memuat breakdown milik sendiri', async () => {
    const res = await request(app.getHttpServer())
      .get('/payouts/balance')
      .set(authOwner())
      .expect(200);
    expect(res.body.available).toBe(190000);
    expect(res.body.breakdown).toHaveLength(1);
    // super_admin tanpa query -> 400.
    await request(app.getHttpServer())
      .get('/payouts/balance')
      .set(authAdmin())
      .expect(400);
    // query setengah (hanya payeeType) -> 400.
    await request(app.getHttpServer())
      .get('/payouts/balance')
      .set(authAdmin())
      .query({ payeeType: 'venue' })
      .expect(400);
  });

  it('request melebihi saldo -> 409; payee tak ada -> 404; lintas owner -> 403', async () => {
    await request(app.getHttpServer())
      .post('/payouts')
      .set(authOwner())
      .send({ payeeType: 'venue', payeeId: venueId, amount: 190001 })
      .expect(409);
    await request(app.getHttpServer())
      .post('/payouts')
      .set(authOwner())
      .send({
        payeeType: 'venue',
        payeeId: '00000000-0000-0000-0000-000000000000',
        amount: 1000,
      })
      .expect(404);
    // Owner B meminta atas venue owner A -> 403.
    await request(app.getHttpServer())
      .post('/payouts')
      .set(authOwner2())
      .send({ payeeType: 'venue', payeeId: venueId, amount: 1000 })
      .expect(403);
    // Owner B mengintip saldo venue A -> 403.
    await request(app.getHttpServer())
      .get('/payouts/balance')
      .set(authOwner2())
      .query({ payeeType: 'venue', payeeId: venueId })
      .expect(403);
    // amount 0 / negatif -> 400.
    await request(app.getHttpServer())
      .post('/payouts')
      .set(authOwner())
      .send({ payeeType: 'venue', payeeId: venueId, amount: 0 })
      .expect(400);
  });

  it('request valid 201 requested; status requested TIDAK mengunci saldo; tercatat di /me', async () => {
    const created = await request(app.getHttpServer())
      .post('/payouts')
      .set(authOwner())
      .send({
        payeeType: 'venue',
        payeeId: venueId,
        amount: 50000,
        bankName: 'BCA',
        accountNumber: '1234567890',
        accountName: 'Owner A',
      })
      .expect(201);
    expect(created.body).toMatchObject({
      payeeType: 'venue',
      payeeId: venueId,
      amount: 50000,
      status: 'requested',
      bankName: 'BCA',
    });
    expect(created.body.reference).toBeNull();

    const balance = await request(app.getHttpServer())
      .get('/payouts/balance')
      .set(authOwner())
      .query({ payeeType: 'venue', payeeId: venueId })
      .expect(200);
    expect(balance.body.available).toBe(190000);
    expect(balance.body.reserved).toBe(0);

    const mine = await request(app.getHttpServer())
      .get('/payouts/me')
      .set(authOwner())
      .expect(200);
    expect(
      (mine.body.data as Array<{ id: string }>).map((p) => p.id),
    ).toContain(created.body.id);

    // Mitra lain tidak melihatnya di /me.
    const mineB = await request(app.getHttpServer())
      .get('/payouts/me')
      .set(authOwner2())
      .expect(200);
    expect(
      (mineB.body.data as Array<{ id: string }>).map((p) => p.id),
    ).not.toContain(created.body.id);
  });

  it('admin list + approve flow; transisi invalid -> 409', async () => {
    const queued = await request(app.getHttpServer())
      .get('/payouts')
      .set(authAdmin())
      .query({ status: 'requested' })
      .expect(200);
    expect(queued.body.meta.total).toBeGreaterThanOrEqual(1);

    const id = (
      queued.body.data as Array<{ id: string; payeeId: string }>
    ).find((p) => p.payeeId === venueId)!.id;

    const approved = await request(app.getHttpServer())
      .post(`/payouts/${id}/approve`)
      .set(authAdmin())
      .send({ reference: 'TRF-EARLY-001' })
      .expect(200);
    expect(approved.body.status).toBe('approved');
    expect(approved.body.reference).toBe('TRF-EARLY-001');
    expect(approved.body.handledBy).toBeTruthy();

    // approve ulang -> 409; reject atas approved -> 409; pay atas approved lain ok.
    await request(app.getHttpServer())
      .post(`/payouts/${id}/approve`)
      .set(authAdmin())
      .send({})
      .expect(409);
    await request(app.getHttpServer())
      .post(`/payouts/${id}/reject`)
      .set(authAdmin())
      .send({ reason: 'x' })
      .expect(409);

    // approved mengunci saldo: reserved 50rb → available 140rb.
    const balance = await request(app.getHttpServer())
      .get('/payouts/balance')
      .set(authOwner())
      .query({ payeeType: 'venue', payeeId: venueId })
      .expect(200);
    expect(balance.body).toMatchObject({ reserved: 50000, available: 140000 });

    // pay tanpa reference -> 400.
    await request(app.getHttpServer())
      .post(`/payouts/${id}/pay`)
      .set(authAdmin())
      .send({})
      .expect(400);

    const paid = await request(app.getHttpServer())
      .post(`/payouts/${id}/pay`)
      .set(authAdmin())
      .send({ reference: 'TRF-FINAL-001' })
      .expect(200);
    expect(paid.body.status).toBe('paid');
    expect(paid.body.reference).toBe('TRF-FINAL-001');

    // paid atas paid -> 409; approve/reject atas paid -> 409.
    await request(app.getHttpServer())
      .post(`/payouts/${id}/pay`)
      .set(authAdmin())
      .send({ reference: 'TRF-X' })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/payouts/${id}/approve`)
      .set(authAdmin())
      .send({})
      .expect(409);
    await request(app.getHttpServer())
      .post(`/payouts/${id}/reject`)
      .set(authAdmin())
      .send({})
      .expect(409);

    // Saldo setelah paid tetap berkurang.
    const after = await request(app.getHttpServer())
      .get('/payouts/balance')
      .set(authOwner())
      .query({ payeeType: 'venue', payeeId: venueId })
      .expect(200);
    expect(after.body).toMatchObject({ reserved: 50000, available: 140000 });
  });

  it('reject flow: rejected tidak mengurangi saldo; pay atas requested -> 409', async () => {
    const created = await request(app.getHttpServer())
      .post('/payouts')
      .set(authSeller())
      .send({ payeeType: 'seller', payeeId: sellerId, amount: 10000 })
      .expect(201);

    // pay langsung atas requested -> 409.
    await request(app.getHttpServer())
      .post(`/payouts/${created.body.id}/pay`)
      .set(authAdmin())
      .send({ reference: 'TRF-Y' })
      .expect(409);

    const rejected = await request(app.getHttpServer())
      .post(`/payouts/${created.body.id}/reject`)
      .set(authAdmin())
      .send({ reason: 'Data bank tidak valid' })
      .expect(200);
    expect(rejected.body.status).toBe('rejected');
    expect(rejected.body.reason).toBe('Data bank tidak valid');

    const balance = await request(app.getHttpServer())
      .get('/payouts/balance')
      .set(authSeller())
      .query({ payeeType: 'seller', payeeId: sellerId })
      .expect(200);
    expect(balance.body).toMatchObject({ reserved: 0, available: 95000 });

    // id tak ada -> 404.
    await request(app.getHttpServer())
      .post('/payouts/00000000-0000-0000-0000-000000000000/approve')
      .set(authAdmin())
      .send({})
      .expect(404);
  });

  it('request tepat sebesar saldo boleh; setelah terkunci request sisa ditolak 409', async () => {
    // Sisa venue A: 140rb. Minta penuh 140rb → 201.
    const full = await request(app.getHttpServer())
      .post('/payouts')
      .set(authOwner())
      .send({ payeeType: 'venue', payeeId: venueId, amount: 140000 })
      .expect(201);
    expect(full.body.status).toBe('requested');
    await request(app.getHttpServer())
      .post(`/payouts/${full.body.id}/approve`)
      .set(authAdmin())
      .send({})
      .expect(200);
    const balance = await request(app.getHttpServer())
      .get('/payouts/balance')
      .set(authOwner())
      .query({ payeeType: 'venue', payeeId: venueId })
      .expect(200);
    expect(balance.body).toMatchObject({ reserved: 190000, available: 0 });

    // Saldo habis → request 1 rupiah pun 409.
    await request(app.getHttpServer())
      .post('/payouts')
      .set(authOwner())
      .send({ payeeType: 'venue', payeeId: venueId, amount: 1 })
      .expect(409);

    // Venue B (tanpa pendapatan) → saldo 0, request 409.
    const zero = await request(app.getHttpServer())
      .get('/payouts/balance')
      .set(authOwner2())
      .query({ payeeType: 'venue', payeeId: venue2Id })
      .expect(200);
    expect(zero.body).toMatchObject({ gross: 0, net: 0, available: 0 });
    await request(app.getHttpServer())
      .post('/payouts')
      .set(authOwner2())
      .send({ payeeType: 'venue', payeeId: venue2Id, amount: 1000 })
      .expect(409);
  });

  it('mitra tak bisa approve/reject/pay sendiri -> 403', async () => {
    const created = await request(app.getHttpServer())
      .post('/payouts')
      .set(authSeller())
      .send({ payeeType: 'seller', payeeId: sellerId, amount: 5000 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/payouts/${created.body.id}/approve`)
      .set(authSeller())
      .send({})
      .expect(403);
    await request(app.getHttpServer())
      .post(`/payouts/${created.body.id}/reject`)
      .set(authSeller())
      .send({})
      .expect(403);
    await request(app.getHttpServer())
      .post(`/payouts/${created.body.id}/pay`)
      .set(authSeller())
      .send({ reference: 'X' })
      .expect(403);
    // Bersihkan via admin agar tidak menggantung (tetap requested, tak kunci saldo).
    await request(app.getHttpServer())
      .post(`/payouts/${created.body.id}/reject`)
      .set(authAdmin())
      .send({ reason: 'cleanup' })
      .expect(200);
  });
});
