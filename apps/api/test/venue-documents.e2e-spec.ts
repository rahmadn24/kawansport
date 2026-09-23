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

describe('Venue documents API-W01 (e2e)', () => {
  let app: INestApplication;
  let users: Repository<User>;
  const ts = Date.now();
  const password = 'Password123!';

  let ownerToken: string;
  let owner2Token: string;
  let userToken: string;
  let adminToken: string;

  let venueId: string; // milik owner1 (pending -> approved)
  let owner2VenueId: string; // milik owner2

  const venuePayload = {
    name: 'GOR W01',
    address: 'Jl. Legalitas No. 1, Jakarta',
    lat: -6.2,
    lng: 106.8,
    sports: ['Futsal'],
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

    const reg1 = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `w01_owner1_${ts}@example.com`, password })
      .expect(201);
    await users.update({ id: reg1.body.user.id }, { role: 'venue_owner' });
    ownerToken = (
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: `w01_owner1_${ts}@example.com`, password })
        .expect(200)
    ).body.accessToken;

    const reg2 = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `w01_owner2_${ts}@example.com`, password })
      .expect(201);
    await users.update({ id: reg2.body.user.id }, { role: 'venue_owner' });
    owner2Token = (
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: `w01_owner2_${ts}@example.com`, password })
        .expect(200)
    ).body.accessToken;

    userToken = (
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: `w01_user_${ts}@example.com`, password })
        .expect(201)
    ).body.accessToken;

    const regAdmin = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `w01_admin_${ts}@example.com`, password })
      .expect(201);
    await users.update({ id: regAdmin.body.user.id }, { role: 'super_admin' });
    adminToken = (
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: `w01_admin_${ts}@example.com`, password })
        .expect(200)
    ).body.accessToken;

    const v1 = await request(app.getHttpServer())
      .post('/venues')
      .set(authOwner())
      .send(venuePayload)
      .expect(201);
    venueId = v1.body.id;

    const v2 = await request(app.getHttpServer())
      .post('/venues')
      .set(authOwner2())
      .send({ ...venuePayload, name: 'GOR W01 Owner2' })
      .expect(201);
    owner2VenueId = v2.body.id;

    await request(app.getHttpServer())
      .post(`/venues/${venueId}/approve`)
      .set(authAdmin())
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('owner tambah dokumen milik sendiri -> 201 status pending', async () => {
    const res = await request(app.getHttpServer())
      .post(`/venues/${venueId}/documents`)
      .set(authOwner())
      .send({ type: 'nib', url: 'https://cdn.example.com/w01-nib.jpg' })
      .expect(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.venueId).toBe(venueId);
    expect(res.body.type).toBe('nib');
    expect(res.body.url).toBe('https://cdn.example.com/w01-nib.jpg');
    expect(res.body.status).toBe('pending');
    expect(res.body.note).toBeNull();
  });

  it('tambah dokumen: URL ilegal / type invalid -> 400', async () => {
    await request(app.getHttpServer())
      .post(`/venues/${venueId}/documents`)
      .set(authOwner())
      .send({ type: 'nib', url: 'http://insecure.example.com/x.jpg' })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/venues/${venueId}/documents`)
      .set(authOwner())
      .send({ type: 'ktp', url: 'https://cdn.example.com/x.jpg' })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/venues/${venueId}/documents`)
      .set(authOwner())
      .send({ url: 'https://cdn.example.com/x.jpg' })
      .expect(400);
  });

  it('tambah dokumen tanpa token -> 401; user biasa -> 403', async () => {
    await request(app.getHttpServer())
      .post(`/venues/${venueId}/documents`)
      .send({ type: 'imb', url: 'https://cdn.example.com/x.jpg' })
      .expect(401);
    await request(app.getHttpServer())
      .post(`/venues/${venueId}/documents`)
      .set(authUser())
      .send({ type: 'imb', url: 'https://cdn.example.com/x.jpg' })
      .expect(403);
  });

  it('lintas owner: tambah + hapus dokumen venue orang lain -> 403', async () => {
    await request(app.getHttpServer())
      .post(`/venues/${venueId}/documents`)
      .set(authOwner2())
      .send({ type: 'imb', url: 'https://cdn.example.com/hack.jpg' })
      .expect(403);

    const detail = await request(app.getHttpServer())
      .get(`/venues/${venueId}`)
      .set(authOwner())
      .expect(200);
    const docId = detail.body.documents[0].id;

    await request(app.getHttpServer())
      .delete(`/venues/${venueId}/documents/${docId}`)
      .set(authOwner2())
      .expect(403);
  });

  it('publik tak lihat docs: detail approved tanpa token tanpa documents/legalitas', async () => {
    const res = await request(app.getHttpServer())
      .get(`/venues/${venueId}`)
      .expect(200);
    expect(res.body.status).toBe('approved');
    expect(res.body).not.toHaveProperty('documents');
    expect(res.body).not.toHaveProperty('legalitas');
  });

  it('legalitas derived: kosong -> parsial -> lengkap', async () => {
    // Venue owner2 belum punya dokumen -> kosong.
    const empty = await request(app.getHttpServer())
      .get(`/venues/${owner2VenueId}`)
      .set(authOwner2())
      .expect(200);
    expect(empty.body.documents).toEqual([]);
    expect(empty.body.legalitas).toBe('kosong');

    // 1 dokumen pending -> parsial.
    const d1 = await request(app.getHttpServer())
      .post(`/venues/${owner2VenueId}/documents`)
      .set(authOwner2())
      .send({ type: 'siup', url: 'https://cdn.example.com/w01-siup.jpg' })
      .expect(201);
    const afterOne = await request(app.getHttpServer())
      .get(`/venues/${owner2VenueId}`)
      .set(authOwner2())
      .expect(200);
    expect(afterOne.body.documents).toHaveLength(1);
    expect(afterOne.body.legalitas).toBe('parsial');

    // 1 verified saja masih parsial (< 2 verified).
    await request(app.getHttpServer())
      .post(`/venues/${owner2VenueId}/documents/${d1.body.id}/verify`)
      .set(authAdmin())
      .send({ status: 'verified' })
      .expect(200);
    const afterVerifyOne = await request(app.getHttpServer())
      .get(`/venues/${owner2VenueId}`)
      .set(authOwner2())
      .expect(200);
    expect(afterVerifyOne.body.legalitas).toBe('parsial');

    // Dokumen ke-2 verified -> lengkap.
    const d2 = await request(app.getHttpServer())
      .post(`/venues/${owner2VenueId}/documents`)
      .set(authOwner2())
      .send({ type: 'imb', url: '/uploads/images/w01-imb.png' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/venues/${owner2VenueId}/documents/${d2.body.id}/verify`)
      .set(authAdmin())
      .send({ status: 'verified' })
      .expect(200);
    const lengkap = await request(app.getHttpServer())
      .get(`/venues/${owner2VenueId}`)
      .set(authOwner2())
      .expect(200);
    expect(lengkap.body.documents).toHaveLength(2);
    expect(lengkap.body.legalitas).toBe('lengkap');

    // Admin juga melihat documents + legalitas.
    const asAdmin = await request(app.getHttpServer())
      .get(`/venues/${owner2VenueId}`)
      .set(authAdmin())
      .expect(200);
    expect(asAdmin.body.documents).toHaveLength(2);
    expect(asAdmin.body.legalitas).toBe('lengkap');
  });

  it('verify: owner biasa -> 403; invalid status -> 400; doc tak ada -> 404', async () => {
    const d = await request(app.getHttpServer())
      .post(`/venues/${venueId}/documents`)
      .set(authOwner())
      .send({ type: 'imb', url: 'https://cdn.example.com/w01-imb.jpg' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/venues/${venueId}/documents/${d.body.id}/verify`)
      .set(authOwner())
      .send({ status: 'verified' })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/venues/${venueId}/documents/${d.body.id}/verify`)
      .set(authAdmin())
      .send({ status: 'pending' })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/venues/${venueId}/documents/${d.body.id}/verify`)
      .set(authAdmin())
      .send({})
      .expect(400);

    await request(app.getHttpServer())
      .post(`/venues/${venueId}/documents/00000000-0000-0000-0000-000000000000/verify`)
      .set(authAdmin())
      .send({ status: 'verified' })
      .expect(404);
  });

  it('verify rejected + note tersimpan; lintas venue -> 404', async () => {
    const d = await request(app.getHttpServer())
      .post(`/venues/${venueId}/documents`)
      .set(authOwner())
      .send({ type: 'sertifikat_tanah', url: 'https://cdn.example.com/w01-shm.jpg' })
      .expect(201);

    const rejected = await request(app.getHttpServer())
      .post(`/venues/${venueId}/documents/${d.body.id}/verify`)
      .set(authAdmin())
      .send({ status: 'rejected', note: 'Foto buram' })
      .expect(200);
    expect(rejected.body.status).toBe('rejected');
    expect(rejected.body.note).toBe('Foto buram');

    // Dokumen venue ini diverify lewat venue lain -> 404.
    await request(app.getHttpServer())
      .post(`/venues/${owner2VenueId}/documents/${d.body.id}/verify`)
      .set(authAdmin())
      .send({ status: 'verified' })
      .expect(404);
  });

  it('owner hapus dokumen milik sendiri -> 204; hapus ulang -> 404', async () => {
    const d = await request(app.getHttpServer())
      .post(`/venues/${venueId}/documents`)
      .set(authOwner())
      .send({ type: 'mou_lainnya', url: 'https://cdn.example.com/w01-mou.jpg' })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/venues/${venueId}/documents/${d.body.id}`)
      .set(authOwner())
      .expect(204);

    await request(app.getHttpServer())
      .delete(`/venues/${venueId}/documents/${d.body.id}`)
      .set(authOwner())
      .expect(404);

    // Hapus via venue lain -> 404 (dokumen milik venueId).
    const d2 = await request(app.getHttpServer())
      .post(`/venues/${venueId}/documents`)
      .set(authOwner())
      .send({ type: 'mou_lainnya', url: 'https://cdn.example.com/w01-mou2.jpg' })
      .expect(201);
    await request(app.getHttpServer())
      .delete(`/venues/${owner2VenueId}/documents/${d2.body.id}`)
      .set(authOwner2())
      .expect(404);
    // Bersihkan.
    await request(app.getHttpServer())
      .delete(`/venues/${venueId}/documents/${d2.body.id}`)
      .set(authOwner())
      .expect(204);
  });

  it('hapus dokumen tanpa token -> 401', async () => {
    const d = await request(app.getHttpServer())
      .post(`/venues/${venueId}/documents`)
      .set(authOwner())
      .send({ type: 'nib', url: 'https://cdn.example.com/w01-del.jpg' })
      .expect(201);
    await request(app.getHttpServer())
      .delete(`/venues/${venueId}/documents/${d.body.id}`)
      .expect(401);
    await request(app.getHttpServer())
      .delete(`/venues/${venueId}/documents/${d.body.id}`)
      .set(authOwner())
      .expect(204);
  });
});
