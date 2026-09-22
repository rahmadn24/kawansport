process.env.DB_DRIVER = 'sqljs';
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '7d';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { User } from '../src/users/user.entity';

describe('Venues BK-01 (e2e)', () => {
  let app: INestApplication;
  let users: Repository<User>;
  const ts = Date.now();
  const password = 'Password123!';

  let ownerToken: string;
  let ownerId: string;
  let owner2Token: string;
  let userToken: string;
  let adminToken: string;

  let venueId: string; // milik owner1 (pending -> approved)
  let adminVenueId: string; // milik admin (draft -> pending -> approved)
  let rejectedVenueId: string; // milik owner2 (pending -> rejected)

  const venuePayload = {
    name: 'GOR Owner Satu',
    address: 'Jl. Merdeka No. 1, Jakarta',
    lat: -6.2,
    lng: 106.8,
    sports: ['Futsal', 'Basket'],
    photos: ['https://cdn.example.com/v1.jpg'],
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
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    users = app.get<Repository<User>>(getRepositoryToken(User));

    // owner1 (venue_owner)
    const reg1 = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `bk01_owner1_${ts}@example.com`, password })
      .expect(201);
    ownerId = reg1.body.user.id;
    await users.update({ id: ownerId }, { role: 'venue_owner' });
    ownerToken = (
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: `bk01_owner1_${ts}@example.com`, password })
        .expect(200)
    ).body.accessToken;

    // owner2 (venue_owner lain)
    const reg2 = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `bk01_owner2_${ts}@example.com`, password })
      .expect(201);
    await users.update({ id: reg2.body.user.id }, { role: 'venue_owner' });
    owner2Token = (
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: `bk01_owner2_${ts}@example.com`, password })
        .expect(200)
    ).body.accessToken;

    // user biasa
    userToken = (
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: `bk01_user_${ts}@example.com`, password })
        .expect(201)
    ).body.accessToken;

    // super_admin
    const regAdmin = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `bk01_admin_${ts}@example.com`, password })
      .expect(201);
    await users.update({ id: regAdmin.body.user.id }, { role: 'super_admin' });
    adminToken = (
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: `bk01_admin_${ts}@example.com`, password })
        .expect(200)
    ).body.accessToken;
  });

  it('POST /venues tanpa token -> 401', async () => {
    await request(app.getHttpServer()).post('/venues').send(venuePayload).expect(401);
  });

  it('POST /venues sebagai user biasa -> 403', async () => {
    await request(app.getHttpServer())
      .post('/venues')
      .set(authUser())
      .send(venuePayload)
      .expect(403);
  });

  it('POST /venues sebagai venue_owner -> 201, status pending, owner = diri sendiri', async () => {
    const res = await request(app.getHttpServer())
      .post('/venues')
      .set(authOwner())
      .send(venuePayload)
      .expect(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe(venuePayload.name);
    expect(res.body.status).toBe('pending');
    expect(res.body.owner.id).toBe(ownerId);
    expect(res.body.sports).toEqual(expect.arrayContaining(['Futsal']));
    venueId = res.body.id;
  });

  it('kolom location terisi (queryable) setelah create', async () => {
    const ds = app.get(DataSource);
    const rows = await ds.query('SELECT location FROM venues WHERE id = ?', [venueId]);
    expect(rows.length).toBe(1);
    expect(String(rows[0].location)).toContain('POINT');
  });

  it('publik: venue pending TIDAK muncul di list maupun detail', async () => {
    const list = await request(app.getHttpServer()).get('/venues').expect(200);
    expect(list.body.meta.total).toBe(0);
    await request(app.getHttpServer()).get(`/venues/${venueId}`).expect(404);
  });

  it('owner bisa melihat venue pending miliknya via detail (dengan token)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/venues/${venueId}`)
      .set(authOwner())
      .expect(200);
    expect(res.body.id).toBe(venueId);
    expect(res.body.status).toBe('pending');
  });

  it('PATCH /venues/:id sebagai user biasa -> 403', async () => {
    await request(app.getHttpServer())
      .patch(`/venues/${venueId}`)
      .set(authUser())
      .send({ name: 'Diubah user' })
      .expect(403);
  });

  it('PATCH /venues/:id sebagai owner lain -> 403', async () => {
    await request(app.getHttpServer())
      .patch(`/venues/${venueId}`)
      .set(authOwner2())
      .send({ name: 'Diubah owner lain' })
      .expect(403);
  });

  it('PATCH /venues/:id owner sendiri -> 200', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/venues/${venueId}`)
      .set(authOwner())
      .send({ name: 'GOR Owner Satu Updated' })
      .expect(200);
    expect(res.body.name).toBe('GOR Owner Satu Updated');
    expect(res.body.status).toBe('pending');
  });

  it('PATCH validasi: lat tanpa lng -> 400', async () => {
    await request(app.getHttpServer())
      .patch(`/venues/${venueId}`)
      .set(authOwner())
      .send({ lat: -6.3 })
      .expect(400);
  });

  it('courts: POST /venues/:id/courts owner sendiri -> 201', async () => {
    const res = await request(app.getHttpServer())
      .post(`/venues/${venueId}/courts`)
      .set(authOwner())
      .send({
        sport: 'Futsal',
        name: 'Lapangan A',
        pricePerHour: 150000,
        openHours: { mon: ['08:00-22:00'] },
      })
      .expect(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.venueId).toBe(venueId);
    expect(res.body.status).toBe('active');
    expect(res.body.pricePerHour).toBe(150000);
  });

  it('courts: POST sebagai owner lain -> 403', async () => {
    await request(app.getHttpServer())
      .post(`/venues/${venueId}/courts`)
      .set(authOwner2())
      .send({ sport: 'Futsal', name: 'Lapangan X', pricePerHour: 100000 })
      .expect(403);
  });

  it('courts: PATCH owner lain -> 403, owner sendiri -> 200', async () => {
    const detail = await request(app.getHttpServer())
      .get(`/venues/${venueId}`)
      .set(authOwner())
      .expect(200);
    const courtId = detail.body.courts[0].id;

    await request(app.getHttpServer())
      .patch(`/venues/${venueId}/courts/${courtId}`)
      .set(authOwner2())
      .send({ pricePerHour: 1 })
      .expect(403);

    const updated = await request(app.getHttpServer())
      .patch(`/venues/${venueId}/courts/${courtId}`)
      .set(authOwner())
      .send({ pricePerHour: 200000 })
      .expect(200);
    expect(updated.body.pricePerHour).toBe(200000);
  });

  it('admin: POST /venues -> draft, submit -> pending, submit ulang -> 409', async () => {
    const created = await request(app.getHttpServer())
      .post('/venues')
      .set(authAdmin())
      .send({ ...venuePayload, name: 'GOR Admin', sports: ['Badminton'] })
      .expect(201);
    expect(created.body.status).toBe('draft');
    adminVenueId = created.body.id;

    // approve langsung dari draft -> 409
    await request(app.getHttpServer())
      .post(`/venues/${adminVenueId}/approve`)
      .set(authAdmin())
      .expect(409);

    const submitted = await request(app.getHttpServer())
      .post(`/venues/${adminVenueId}/submit`)
      .set(authAdmin())
      .expect(201);
    expect(submitted.body.status).toBe('pending');

    await request(app.getHttpServer())
      .post(`/venues/${adminVenueId}/submit`)
      .set(authAdmin())
      .expect(409);
  });

  it('admin approve pending -> approved; non-admin approve -> 403', async () => {
    await request(app.getHttpServer())
      .post(`/venues/${adminVenueId}/approve`)
      .set(authOwner())
      .expect(403);

    const res = await request(app.getHttpServer())
      .post(`/venues/${adminVenueId}/approve`)
      .set(authAdmin())
      .expect(201);
    expect(res.body.status).toBe('approved');
  });

  it('admin approve venue owner1 -> approved; publik kini memuatnya', async () => {
    await request(app.getHttpServer())
      .post(`/venues/${venueId}/approve`)
      .set(authAdmin())
      .expect(201);

    const list = await request(app.getHttpServer()).get('/venues').expect(200);
    const ids = (list.body.data as Array<{ id: string }>).map((v) => v.id);
    expect(ids).toContain(venueId);
    expect(ids).toContain(adminVenueId);

    const detail = await request(app.getHttpServer()).get(`/venues/${venueId}`).expect(200);
    expect(detail.body.status).toBe('approved');
    expect(detail.body.courts.length).toBeGreaterThanOrEqual(1);
  });

  it('admin reject pending + reason -> rejected; publik mengecualikan', async () => {
    const created = await request(app.getHttpServer())
      .post('/venues')
      .set(authOwner2())
      .send({ ...venuePayload, name: 'GOR Ditolak', sports: ['Tenis'] })
      .expect(201);
    rejectedVenueId = created.body.id;

    const rejected = await request(app.getHttpServer())
      .post(`/venues/${rejectedVenueId}/reject`)
      .set(authAdmin())
      .send({ reason: 'Alamat tidak valid' })
      .expect(200);
    expect(rejected.body.status).toBe('rejected');
    expect(rejected.body.rejectionReason).toBe('Alamat tidak valid');

    const list = await request(app.getHttpServer()).get('/venues').expect(200);
    const ids = (list.body.data as Array<{ id: string }>).map((v) => v.id);
    expect(ids).not.toContain(rejectedVenueId);
    await request(app.getHttpServer()).get(`/venues/${rejectedVenueId}`).expect(404);
  });

  it('geo + sport: publik hanya approved, urut jarak ASC, filter sport', async () => {
    const sport = `GeoSport${ts}`;
    const mk = (name: string, lat: number, lng: number) =>
      request(app.getHttpServer()).post('/venues').set(authOwner()).send({
        name,
        address: 'Alamat geo',
        lat,
        lng,
        sports: [sport],
      });

    const near = await mk('Geo Near', -6.2, 106.8).expect(201);
    const far = await mk('Geo Far', -6.35, 106.95).expect(201);
    await request(app.getHttpServer())
      .post(`/venues/${near.body.id}/approve`)
      .set(authAdmin())
      .expect(201);
    await request(app.getHttpServer())
      .post(`/venues/${far.body.id}/approve`)
      .set(authAdmin())
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/venues')
      .query({ sport: sport.toLowerCase(), lat: -6.2, lng: 106.8, radius: 50000 })
      .expect(200);
    expect(res.body.meta.total).toBe(2);
    expect(res.body.data[0].id).toBe(near.body.id);
    expect(res.body.data[1].id).toBe(far.body.id);
    expect(res.body.data[0].distanceMeters).toBeLessThanOrEqual(
      res.body.data[1].distanceMeters,
    );

    // radius kecil: hanya yang dekat
    const narrow = await request(app.getHttpServer())
      .get('/venues')
      .query({ sport, lat: -6.2, lng: 106.8, radius: 1000 })
      .expect(200);
    expect(narrow.body.data.map((v: { id: string }) => v.id)).toEqual([near.body.id]);

    // sport tidak cocok: tidak ada hasil geo
    const miss = await request(app.getHttpServer())
      .get('/venues')
      .query({ sport: 'Catur', lat: -6.2, lng: 106.8, radius: 50000 })
      .expect(200);
    expect(miss.body.data.map((v: { id: string }) => v.id)).not.toContain(near.body.id);
  });

  it('GET /venues?page=&limit= paginasi + meta', async () => {
    const res = await request(app.getHttpServer())
      .get('/venues')
      .query({ page: 1, limit: 1 })
      .expect(200);
    expect(res.body.data.length).toBeLessThanOrEqual(1);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 1 });
    expect(typeof res.body.meta.total).toBe('number');
  });

  it('POST /venues validasi: tanpa nama -> 400', async () => {
    await request(app.getHttpServer())
      .post('/venues')
      .set(authOwner())
      .send({ ...venuePayload, name: '' })
      .expect(400);
  });

  afterAll(async () => {
    await app.close();
  });
});
