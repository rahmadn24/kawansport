process.env.DB_DRIVER = 'sqljs';
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '7d';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { existsSync } from 'fs';
import { join } from 'path';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { User } from '../src/users/user.entity';
import { getImagesDir } from '../src/users/upload.config';

/** 1x1 PNG valid untuk test upload. */
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('Media ST-01 (e2e)', () => {
  let app: INestApplication;
  let users: Repository<User>;
  const ts = Date.now();
  const password = 'Password123!';

  let ownerToken: string;
  let hostToken: string;
  let reviewerToken: string;
  let sellerToken: string;
  let strangerToken: string;
  let adminToken: string;

  let uploadedUrl: string;
  let venueId: string;
  let eventId: string;
  let ratingId: string;
  let productId: string;

  const authOwner = () => ({ Authorization: `Bearer ${ownerToken}` });
  const authHost = () => ({ Authorization: `Bearer ${hostToken}` });
  const authReviewer = () => ({ Authorization: `Bearer ${reviewerToken}` });
  const authSeller = () => ({ Authorization: `Bearer ${sellerToken}` });
  const authStranger = () => ({ Authorization: `Bearer ${strangerToken}` });
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

    const regOwner = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `st01_owner_${ts}@example.com`, password })
      .expect(201);
    await users.update({ id: regOwner.body.user.id }, { role: 'venue_owner' });
    ownerToken = await login(`st01_owner_${ts}@example.com`);

    hostToken = (
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: `st01_host_${ts}@example.com`, password })
        .expect(201)
    ).body.accessToken;

    reviewerToken = (
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: `st01_reviewer_${ts}@example.com`, password })
        .expect(201)
    ).body.accessToken;

    sellerToken = (
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: `st01_seller_${ts}@example.com`, password })
        .expect(201)
    ).body.accessToken;

    strangerToken = (
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: `st01_stranger_${ts}@example.com`, password })
        .expect(201)
    ).body.accessToken;

    const regAdmin = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `st01_admin_${ts}@example.com`, password })
      .expect(201);
    await users.update({ id: regAdmin.body.user.id }, { role: 'super_admin' });
    adminToken = await login(`st01_admin_${ts}@example.com`);

    // Seller onboarding + approve.
    const seller = await request(app.getHttpServer())
      .post('/sellers')
      .set(authSeller())
      .send({ shopName: 'Toko ST01' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/sellers/${seller.body.id}/approve`)
      .set(authAdmin())
      .expect(201);
    sellerToken = await login(`st01_seller_${ts}@example.com`);
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /uploads tanpa token -> 401', async () => {
    await request(app.getHttpServer())
      .post('/uploads')
      .attach('file', PNG_1PX, { filename: 'x.png', contentType: 'image/png' })
      .expect(401);
  });

  it('POST /uploads png -> 201 { url } + file tersimpan', async () => {
    const res = await request(app.getHttpServer())
      .post('/uploads')
      .set(authOwner())
      .attach('file', PNG_1PX, { filename: 'foto.png', contentType: 'image/png' })
      .expect(201);
    expect(res.body.url).toMatch(/^\/uploads\/images\/.+\.png$/);
    uploadedUrl = res.body.url;
    const filename = String(uploadedUrl).split('/').pop() as string;
    expect(existsSync(join(getImagesDir(), filename))).toBe(true);
  });

  it('POST /uploads file bukan gambar -> 400', async () => {
    await request(app.getHttpServer())
      .post('/uploads')
      .set(authOwner())
      .attach('file', Buffer.from('hello'), {
        filename: 'note.txt',
        contentType: 'text/plain',
      })
      .expect(400);
  });

  it('POST /uploads isi bukan gambar tapi mimetype image -> 400 (magic bytes)', async () => {
    await request(app.getHttpServer())
      .post('/uploads')
      .set(authOwner())
      .attach('file', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), {
        filename: 'evil.png',
        contentType: 'image/png',
      })
      .expect(400);
  });

  it('venue: create dengan foto upload + https -> 201, terbaca di detail', async () => {
    const res = await request(app.getHttpServer())
      .post('/venues')
      .set(authOwner())
      .send({
        name: 'GOR ST01',
        address: 'Jl. ST01 No. 1',
        lat: -6.2,
        lng: 106.8,
        sports: ['Futsal'],
        photos: [uploadedUrl, 'https://cdn.example.com/st01.jpg'],
      })
      .expect(201);
    venueId = res.body.id;
    expect(res.body.photos).toEqual([uploadedUrl, 'https://cdn.example.com/st01.jpg']);

    const detail = await request(app.getHttpServer())
      .get(`/venues/${venueId}`)
      .set(authOwner())
      .expect(200);
    expect(detail.body.photos).toEqual([uploadedUrl, 'https://cdn.example.com/st01.jpg']);

    await request(app.getHttpServer())
      .post(`/venues/${venueId}/approve`)
      .set(authAdmin())
      .expect(201);
  });

  it('venue: URL foto ilegal (http) -> 400', async () => {
    await request(app.getHttpServer())
      .post('/venues')
      .set(authOwner())
      .send({
        name: 'GOR ST01 Ilegal',
        address: 'Jl. ST01 No. 2',
        lat: -6.2,
        lng: 106.8,
        sports: ['Futsal'],
        photos: ['http://insecure.example.com/x.jpg'],
      })
      .expect(400);
  });

  it('venue: >5 foto -> 400', async () => {
    await request(app.getHttpServer())
      .post('/venues')
      .set(authOwner())
      .send({
        name: 'GOR ST01 Banyak',
        address: 'Jl. ST01 No. 3',
        lat: -6.2,
        lng: 106.8,
        sports: ['Futsal'],
        photos: [
          'https://cdn.example.com/1.jpg',
          'https://cdn.example.com/2.jpg',
          'https://cdn.example.com/3.jpg',
          'https://cdn.example.com/4.jpg',
          'https://cdn.example.com/5.jpg',
          'https://cdn.example.com/6.jpg',
        ],
      })
      .expect(400);
  });

  it('venue approved: tambah foto via POST /venues/:id/photos -> 200 langsung (tanpa CR)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/venues/${venueId}/photos`)
      .set(authOwner())
      .send({ url: 'https://cdn.example.com/st01-extra.jpg' })
      .expect(201);
    expect(res.body.photos).toContain('https://cdn.example.com/st01-extra.jpg');
    expect(res.body.pendingReview).toBeUndefined();
  });

  it('venue: tambah foto oleh bukan owner -> 403; URL ilegal -> 400', async () => {
    await request(app.getHttpServer())
      .post(`/venues/${venueId}/photos`)
      .set(authStranger())
      .send({ url: 'https://cdn.example.com/hack.jpg' })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/venues/${venueId}/photos`)
      .set(authOwner())
      .send({ url: 'http://insecure.example.com/hack.jpg' })
      .expect(400);
  });

  it('venue approved: edit photos via PATCH langsung 200 (bukan 202)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/venues/${venueId}`)
      .set(authOwner())
      .send({ photos: [uploadedUrl] })
      .expect(200);
    expect(res.body.pendingReview).toBeUndefined();
    expect(res.body.photos).toEqual([uploadedUrl]);
  });

  it('venue: hapus foto via DELETE /venues/:id/photos -> 200; yang tidak ada -> 404', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/venues/${venueId}/photos`)
      .set(authOwner())
      .send({ url: uploadedUrl })
      .expect(200);
    expect(res.body.photos).not.toContain(uploadedUrl);
    await request(app.getHttpServer())
      .delete(`/venues/${venueId}/photos`)
      .set(authOwner())
      .send({ url: uploadedUrl })
      .expect(404);
  });

  it('event: create dengan foto -> 201, terbaca di detail', async () => {
    const res = await request(app.getHttpServer())
      .post('/events')
      .set(authHost())
      .send({
        sport: 'Futsal',
        title: 'Sparing ST01',
        description: 'Main santai',
        datetime: '2026-11-01T09:00:00+07:00',
        lat: -6.2,
        lng: 106.8,
        capacity: 10,
        photos: [uploadedUrl, 'https://cdn.example.com/ev01.jpg'],
      })
      .expect(201);
    eventId = res.body.id;
    expect(res.body.photos).toEqual([uploadedUrl, 'https://cdn.example.com/ev01.jpg']);

    const detail = await request(app.getHttpServer())
      .get(`/events/${eventId}`)
      .set(authHost())
      .expect(200);
    expect(detail.body.photos).toEqual([uploadedUrl, 'https://cdn.example.com/ev01.jpg']);
  });

  it('event: host PATCH foto -> 200; bukan host -> 403; >5 foto -> 400', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/events/${eventId}`)
      .set(authHost())
      .send({ photos: ['https://cdn.example.com/ev02.jpg'] })
      .expect(200);
    expect(res.body.photos).toEqual(['https://cdn.example.com/ev02.jpg']);

    await request(app.getHttpServer())
      .patch(`/events/${eventId}`)
      .set(authStranger())
      .send({ photos: ['https://cdn.example.com/hack.jpg'] })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/events/${eventId}`)
      .set(authHost())
      .send({
        photos: [
          'https://cdn.example.com/1.jpg',
          'https://cdn.example.com/2.jpg',
          'https://cdn.example.com/3.jpg',
          'https://cdn.example.com/4.jpg',
          'https://cdn.example.com/5.jpg',
          'https://cdn.example.com/6.jpg',
        ],
      })
      .expect(400);
  });

  it('review: create dengan foto (tanpa comment) -> 201 review berfoto', async () => {
    const res = await request(app.getHttpServer())
      .post('/ratings')
      .set(authReviewer())
      .send({ venueId, score: 5, photos: [uploadedUrl] })
      .expect(201);
    ratingId = res.body.id;
    expect(res.body.review).toMatchObject({ photos: [uploadedUrl] });

    const detail = await request(app.getHttpServer())
      .get(`/ratings/${ratingId}`)
      .expect(200);
    expect(detail.body.review.photos).toEqual([uploadedUrl]);
  });

  it('review: update foto -> 200; >3 foto -> 400', async () => {
    const res = await request(app.getHttpServer())
      .put(`/ratings/${ratingId}`)
      .set(authReviewer())
      .send({ photos: [uploadedUrl, 'https://cdn.example.com/rv01.jpg'] })
      .expect(200);
    expect(res.body.review.photos).toEqual([
      uploadedUrl,
      'https://cdn.example.com/rv01.jpg',
    ]);

    await request(app.getHttpServer())
      .post('/ratings')
      .set(authStranger())
      .send({
        venueId,
        score: 4,
        comment: 'ok',
        photos: [
          'https://cdn.example.com/1.jpg',
          'https://cdn.example.com/2.jpg',
          'https://cdn.example.com/3.jpg',
          'https://cdn.example.com/4.jpg',
        ],
      })
      .expect(400);
  });

  it('produk: create dengan foto -> pending; approve -> foto tampil publik', async () => {
    const created = await request(app.getHttpServer())
      .post('/products')
      .set(authSeller())
      .send({
        category: 'Jersey',
        name: 'Jersey ST01',
        description: 'Adem',
        price: 150000,
        stock: 5,
        photos: [uploadedUrl, 'https://cdn.example.com/p01.jpg'],
      })
      .expect(201);
    productId = created.body.id;
    expect(created.body.photos).toEqual([
      uploadedUrl,
      'https://cdn.example.com/p01.jpg',
    ]);

    await request(app.getHttpServer())
      .post(`/products/${productId}/approve`)
      .set(authAdmin())
      .expect(201);

    const detail = await request(app.getHttpServer())
      .get(`/products/${productId}`)
      .expect(200);
    expect(detail.body.photos).toEqual([
      uploadedUrl,
      'https://cdn.example.com/p01.jpg',
    ]);

    const list = await request(app.getHttpServer()).get('/products').expect(200);
    const found = (list.body.data as Array<{ id: string; photos: string[] }>).find(
      (p) => p.id === productId,
    );
    expect(found?.photos).toEqual([uploadedUrl, 'https://cdn.example.com/p01.jpg']);
  });

  it('produk: URL foto ilegal -> 400', async () => {
    await request(app.getHttpServer())
      .post('/products')
      .set(authSeller())
      .send({
        category: 'Jersey',
        name: 'Jersey ST01 Ilegal',
        price: 100000,
        stock: 1,
        photos: ['ftp://files.example.com/x.jpg'],
      })
      .expect(400);
  });
});
