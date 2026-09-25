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
 * ST-09 e2e: pencarian gabungan publik + banner promo CMS-managed.
 * - GET /search publik (tanpa auth): venue approved + event + produk
 *   approved; substring case-insensitive; geo opsional -> distanceMeters
 *   + sort jarak, else sort abjad.
 * - Promos: CRUD super_admin; publik hanya active + dalam periode.
 */
describe('Search + Promos ST-09 (e2e)', () => {
  let app: INestApplication;
  let users: Repository<User>;
  const ts = Date.now();
  const password = 'Password123!';

  let ownerToken: string;
  let sellerToken: string;
  let adminToken: string;
  let plainToken: string;

  const authOwner = () => ({ Authorization: `Bearer ${ownerToken}` });
  const authSeller = () => ({ Authorization: `Bearer ${sellerToken}` });
  const authAdmin = () => ({ Authorization: `Bearer ${adminToken}` });
  const authPlain = () => ({ Authorization: `Bearer ${plainToken}` });

  const login = async (email: string) =>
    (
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(200)
    ).body.accessToken as string;

  // Koordinat acuan: Jakarta (-6.2, 106.8). Venue/event dekat di sini,
  // satu venue jauh di Bandung (-6.9, 107.6).
  const JKT = { lat: -6.2, lng: 106.8 };
  const BDG = { lat: -6.9, lng: 107.6 };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    users = app.get<Repository<User>>(getRepositoryToken(User));

    // owner venue
    const regOwner = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `st09_owner_${ts}@example.com`, password })
      .expect(201);
    await users.update({ id: regOwner.body.user.id }, { role: 'venue_owner' });
    ownerToken = await login(`st09_owner_${ts}@example.com`);

    // seller (apply -> approve -> bisa buat produk)
    sellerToken = (
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: `st09_seller_${ts}@example.com`, password })
        .expect(201)
    ).body.accessToken;

    // user biasa (host event + 403 guard promos)
    plainToken = (
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: `st09_plain_${ts}@example.com`, password })
        .expect(201)
    ).body.accessToken;

    // super_admin
    const regAdmin = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `st09_admin_${ts}@example.com`, password })
      .expect(201);
    await users.update({ id: regAdmin.body.user.id }, { role: 'super_admin' });
    adminToken = await login(`st09_admin_${ts}@example.com`);

    // --- Seed venue: 1 dekat approved, 1 jauh approved, 1 dekat pending ---
    const mkVenue = async (name: string, lat: number, lng: number) =>
      (
        await request(app.getHttpServer())
          .post('/venues')
          .set(authOwner())
          .send({
            name,
            address: `Jl. ${name} No. 1`,
            lat,
            lng,
            sports: ['Futsal'],
          })
          .expect(201)
      ).body;
    const near = await mkVenue(`GOR Mabar Near ${ts}`, JKT.lat, JKT.lng);
    const far = await mkVenue(`GOR Mabar Far ${ts}`, BDG.lat, BDG.lng);
    await mkVenue(`GOR Mabar Pending ${ts}`, JKT.lat, JKT.lng);
    await request(app.getHttpServer())
      .post(`/venues/${near.id}/approve`)
      .set(authAdmin())
      .expect(201);
    await request(app.getHttpServer())
      .post(`/venues/${far.id}/approve`)
      .set(authAdmin())
      .expect(201);

    // --- Seed event dekat (host = plain user) ---
    const future = new Date(Date.now() + 7 * 86400000).toISOString();
    await request(app.getHttpServer())
      .post('/events')
      .set(authPlain())
      .send({
        sport: 'Futsal',
        title: `Mabar Seru ${ts}`,
        description: 'Mabar futsal bareng kawan',
        datetime: future,
        lat: JKT.lat,
        lng: JKT.lng,
        capacity: 10,
      })
      .expect(201);

    // --- Seed seller + produk approved ---
    const seller = (
      await request(app.getHttpServer())
        .post('/sellers')
        .set(authSeller())
        .send({ shopName: `Toko ST09 ${ts}` })
        .expect(201)
    ).body;
    await request(app.getHttpServer())
      .post(`/sellers/${seller.id}/approve`)
      .set(authAdmin())
      .expect(201);
    const product = (
      await request(app.getHttpServer())
        .post('/products')
        .set(authSeller())
        .send({
          category: 'Badminton',
          name: `Raket Mabar Pro ${ts}`,
          description: 'Raket mabar ringan',
          price: 250000,
          stock: 10,
        })
        .expect(201)
    ).body;
    await request(app.getHttpServer())
      .post(`/products/${product.id}/approve`)
      .set(authAdmin())
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /search tanpa token -> 200 (publik, tanpa auth)', async () => {
    const res = await request(app.getHttpServer())
      .get('/search')
      .query({ q: `mabar`, limit: 50 })
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    const kinds = res.body.data.map((r: { kind: string }) => r.kind);
    // Venue dekat+jauh approved + event + produk ikut; venue pending TIDAK.
    expect(kinds).toContain('venue');
    expect(kinds).toContain('event');
    expect(kinds).toContain('product');
    expect(
      res.body.data.some((r: { title: string }) =>
        String(r.title).toLowerCase().includes('pending'),
      ),
    ).toBe(false);
    expect(res.body.meta.total).toBe(res.body.data.length);
  });

  it('GET /search substring case-insensitive (nama/deskripsi)', async () => {
    const res = await request(app.getHttpServer())
      .get('/search')
      .query({ q: `RAKET mabar` })
      .expect(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].kind).toBe('product');
    // Tanpa geo: sort abjad title ASC.
    const titles = res.body.data.map((r: { title: string }) => r.title);
    expect([...titles].sort((a, b) => a.localeCompare(b))).toEqual(titles);
  });

  it('GET /search geo -> distanceMeters + sort jarak, produk tanpa jarak di belakang', async () => {
    const res = await request(app.getHttpServer())
      .get('/search')
      .query({ q: 'mabar', lat: JKT.lat, lng: JKT.lng, radius: 100000, limit: 50 })
      .expect(200);
    const rows = res.body.data as Array<{
      kind: string;
      distanceMeters?: number;
    }>;
    const geo = rows.filter((r) => r.distanceMeters !== undefined);
    const nongeo = rows.filter((r) => r.distanceMeters === undefined);
    expect(geo.length).toBeGreaterThanOrEqual(2);
    // Sort jarak ASC.
    for (let i = 1; i < geo.length; i++) {
      expect(geo[i].distanceMeters as number).toBeGreaterThanOrEqual(
        geo[i - 1].distanceMeters as number,
      );
    }
    // Venue dekat harus lebih dulu daripada venue jauh.
    expect(geo[0].distanceMeters as number).toBeLessThan(5000);
    // Produk (tanpa koordinat) selalu ikut walau radius kecil, di belakang.
    expect(nongeo.length).toBeGreaterThanOrEqual(1);
    expect(nongeo.every((r) => r.kind === 'product')).toBe(true);
  });

  it('GET /search geo radius kecil -> venue jauh tersaring, produk tetap ikut', async () => {
    const res = await request(app.getHttpServer())
      .get('/search')
      .query({ q: 'mabar', lat: JKT.lat, lng: JKT.lng, radius: 5000, limit: 50 })
      .expect(200);
    const rows = res.body.data as Array<{ kind: string; title: string }>;
    expect(
      rows.some((r) => r.kind === 'venue' && r.title.toLowerCase().includes('far')),
    ).toBe(false);
    expect(rows.some((r) => r.kind === 'product')).toBe(true);
  });

  it('GET /search lat tanpa lng -> 400', async () => {
    await request(app.getHttpServer())
      .get('/search')
      .query({ q: 'mabar', lat: JKT.lat })
      .expect(400);
  });

  it('POST /promos non-admin -> 403; tanpa token -> 401', async () => {
    await request(app.getHttpServer())
      .post('/promos')
      .set(authPlain())
      .send({ title: 'X', imageUrl: 'https://cdn.example.com/x.jpg' })
      .expect(403);
    await request(app.getHttpServer())
      .post('/promos')
      .send({ title: 'X', imageUrl: 'https://cdn.example.com/x.jpg' })
      .expect(401);
  });

  it('POST /promos imageUrl ilegal (http) -> 400', async () => {
    await request(app.getHttpServer())
      .post('/promos')
      .set(authAdmin())
      .send({ title: 'Promo X', imageUrl: 'http://insecure.example.com/x.jpg' })
      .expect(400);
  });

  it('POST /promos startsAt > endsAt -> 400', async () => {
    await request(app.getHttpServer())
      .post('/promos')
      .set(authAdmin())
      .send({
        title: 'Promo X',
        imageUrl: 'https://cdn.example.com/x.jpg',
        startsAt: new Date(Date.now() + 86400000).toISOString(),
        endsAt: new Date(Date.now() - 86400000).toISOString(),
      })
      .expect(400);
  });

  it('CRUD promo + visibilitas publik (active + periode)', async () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    const future = new Date(Date.now() + 86400000).toISOString();
    const farFuture = new Date(Date.now() + 2 * 86400000).toISOString();

    // Banner live (active, dalam periode).
    const live = (
      await request(app.getHttpServer())
        .post('/promos')
        .set(authAdmin())
        .send({
          title: `Promo Live ${ts}`,
          imageUrl: 'https://cdn.example.com/live.jpg',
          link: 'kawansport://events',
          startsAt: past,
          endsAt: future,
        })
        .expect(201)
    ).body;
    expect(live.active).toBe(true);

    // Banner nonaktif + banner kedaluwarsa (tidak boleh tampil publik).
    const off = (
      await request(app.getHttpServer())
        .post('/promos')
        .set(authAdmin())
        .send({
          title: `Promo Off ${ts}`,
          imageUrl: 'https://cdn.example.com/off.jpg',
          active: false,
        })
        .expect(201)
    ).body;
    await request(app.getHttpServer())
      .post('/promos')
      .set(authAdmin())
      .send({
        title: `Promo Expired ${ts}`,
        imageUrl: 'https://cdn.example.com/exp.jpg',
        startsAt: new Date(Date.now() - 3 * 86400000).toISOString(),
        endsAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      })
      .expect(201);

    // Publik: hanya yang live.
    const pub = await request(app.getHttpServer()).get('/promos').expect(200);
    const pubTitles = (pub.body.data as Array<{ title: string }>).map((p) => p.title);
    expect(pubTitles).toContain(`Promo Live ${ts}`);
    expect(pubTitles).not.toContain(`Promo Off ${ts}`);
    expect(pubTitles).not.toContain(`Promo Expired ${ts}`);

    // ?all=true tanpa token -> 401; non-admin -> 403.
    await request(app.getHttpServer()).get('/promos').query({ all: true }).expect(401);
    await request(app.getHttpServer())
      .get('/promos')
      .query({ all: true })
      .set(authPlain())
      .expect(403);

    // ?all=true admin -> semua termasuk nonaktif/kedaluwarsa.
    const all = await request(app.getHttpServer())
      .get('/promos')
      .query({ all: true })
      .set(authAdmin())
      .expect(200);
    const allTitles = (all.body.data as Array<{ title: string }>).map((p) => p.title);
    expect(allTitles).toContain(`Promo Off ${ts}`);
    expect(allTitles).toContain(`Promo Expired ${ts}`);

    // Nonaktifkan yang live -> hilang dari publik.
    await request(app.getHttpServer())
      .patch(`/promos/${live.id}`)
      .set(authAdmin())
      .send({ active: false })
      .expect(200);
    const pub2 = await request(app.getHttpServer()).get('/promos').expect(200);
    expect(
      (pub2.body.data as Array<{ title: string }>).map((p) => p.title),
    ).not.toContain(`Promo Live ${ts}`);

    // PATCH jadwal jadi live lagi + ganti title.
    await request(app.getHttpServer())
      .patch(`/promos/${live.id}`)
      .set(authAdmin())
      .send({ active: true, title: `Promo Live Renov ${ts}`, startsAt: past, endsAt: farFuture })
      .expect(200);

    // DELETE banner nonaktif -> 204; hapus ulang -> 404.
    await request(app.getHttpServer())
      .delete(`/promos/${off.id}`)
      .set(authAdmin())
      .expect(204);
    await request(app.getHttpServer())
      .delete(`/promos/${off.id}`)
      .set(authAdmin())
      .expect(404);

    // PATCH/DELETE non-admin -> 403.
    await request(app.getHttpServer())
      .patch(`/promos/${live.id}`)
      .set(authOwner())
      .send({ title: 'Hacked' })
      .expect(403);
    await request(app.getHttpServer())
      .delete(`/promos/${live.id}`)
      .set(authPlain())
      .expect(403);
  });
});
