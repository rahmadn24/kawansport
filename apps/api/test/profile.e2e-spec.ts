process.env.DB_DRIVER = 'sqljs';
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '7d';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { existsSync } from 'fs';
import { join } from 'path';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { getAvatarDir } from '../src/users/upload.config';

/** 1x1 PNG valid untuk test upload avatar. */
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('Profile /me (e2e) SM-03', () => {
  let app: INestApplication;
  const email = `sm03_${Date.now()}@example.com`;
  const password = 'Password123!';
  let accessToken: string;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    const reg = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, displayName: 'SM03 User' })
      .expect(201);
    accessToken = reg.body.accessToken;
    userId = reg.body.user.id;
  });

  const auth = () => ({ Authorization: `Bearer ${accessToken}` });

  it('GET /me mengembalikan profil lengkap SM-03', async () => {
    const res = await request(app.getHttpServer())
      .get('/me')
      .set(auth())
      .expect(200);
    expect(res.body.email).toBe(email);
    expect(res.body.sports).toEqual([]);
    expect(res.body.skillLevel).toBeNull();
    expect(res.body.lat).toBeNull();
    expect(res.body.lng).toBeNull();
    expect(res.body.avatarUrl).toBeNull();
  });

  it('PATCH /me menyimpan sports/skill/lokasi', async () => {
    const res = await request(app.getHttpServer())
      .patch('/me')
      .set(auth())
      .send({
        displayName: 'SM03 Edited',
        sports: ['Futsal', ' Basket ', 'futsal', ''],
        skillLevel: 'intermediate',
        lat: -6.2,
        lng: 106.8,
      })
      .expect(200);
    // sports dinormalisasi: trim + dedupe case-insensitive + buang kosong.
    expect(res.body.displayName).toBe('SM03 Edited');
    expect(res.body.sports).toEqual(['Futsal', 'Basket']);
    expect(res.body.skillLevel).toBe('intermediate');
    expect(res.body.lat).toBeCloseTo(-6.2);
    expect(res.body.lng).toBeCloseTo(106.8);
  });

  it('kolom geo terisi (queryable) setelah update lokasi', async () => {
    const ds = app.get(DataSource);
    const rows = await ds.query('SELECT location FROM users WHERE id = ?', [userId]);
    expect(rows.length).toBe(1);
    expect(rows[0].location).toBeTruthy();
    expect(String(rows[0].location)).toContain('POINT');
  });

  it('GET /me sesudah PATCH mengembalikan profil lengkap', async () => {
    const res = await request(app.getHttpServer())
      .get('/me')
      .set(auth())
      .expect(200);
    expect(res.body.sports).toEqual(['Futsal', 'Basket']);
    expect(res.body.skillLevel).toBe('intermediate');
    expect(res.body.lat).toBeCloseTo(-6.2);
    expect(res.body.lng).toBeCloseTo(106.8);
  });

  it('PATCH /me validasi: skill salah -> 400', async () => {
    await request(app.getHttpServer())
      .patch('/me')
      .set(auth())
      .send({ skillLevel: 'pro' })
      .expect(400);
  });

  it('PATCH /me validasi: lat tanpa lng -> 400', async () => {
    await request(app.getHttpServer())
      .patch('/me')
      .set(auth())
      .send({ lat: -6.2 })
      .expect(400);
  });

  it('PATCH /me validasi: lat di luar rentang -> 400', async () => {
    await request(app.getHttpServer())
      .patch('/me')
      .set(auth())
      .send({ lat: 120, lng: 106 })
      .expect(400);
  });

  it('PATCH /me tanpa token -> 401', async () => {
    await request(app.getHttpServer()).patch('/me').send({ displayName: 'x' }).expect(401);
  });

  it('PATCH /me lat/lng null menghapus lokasi + kolom geo dikosongkan', async () => {
    const res = await request(app.getHttpServer())
      .patch('/me')
      .set(auth())
      .send({ lat: null, lng: null })
      .expect(200);
    expect(res.body.lat).toBeNull();
    expect(res.body.lng).toBeNull();
    const ds = app.get(DataSource);
    const rows = await ds.query('SELECT location FROM users WHERE id = ?', [userId]);
    expect(rows[0].location).toBeNull();
    // Kembalikan lokasi agar state akhir konsisten.
    await request(app.getHttpServer())
      .patch('/me')
      .set(auth())
      .send({ lat: -6.2, lng: 106.8 })
      .expect(200);
  });

  it('POST /me/avatar upload png -> 200 + file tersimpan', async () => {
    const res = await request(app.getHttpServer())
      .post('/me/avatar')
      .set(auth())
      .attach('avatar', PNG_1PX, { filename: 'avatar.png', contentType: 'image/png' })
      .expect(201);
    expect(res.body.avatarUrl).toMatch(/^\/uploads\/avatars\/.+\.png$/);
    const filename = String(res.body.avatarUrl).split('/').pop() as string;
    expect(existsSync(join(getAvatarDir(), filename))).toBe(true);

    const me = await request(app.getHttpServer()).get('/me').set(auth()).expect(200);
    expect(me.body.avatarUrl).toBe(res.body.avatarUrl);
  });

  it('POST /me/avatar file bukan gambar -> 400', async () => {
    await request(app.getHttpServer())
      .post('/me/avatar')
      .set(auth())
      .attach('avatar', Buffer.from('hello'), {
        filename: 'note.txt',
        contentType: 'text/plain',
      })
      .expect(400);
  });

  it('POST /me/avatar isi bukan gambar tapi mimetype image -> 400 (magic bytes)', async () => {
    await request(app.getHttpServer())
      .post('/me/avatar')
      .set(auth())
      .attach('avatar', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), {
        filename: 'evil.png',
        contentType: 'image/png',
      })
      .expect(400);
  });

  it('POST /me/avatar tanpa token -> 401', async () => {
    await request(app.getHttpServer())
      .post('/me/avatar')
      .attach('avatar', PNG_1PX, { filename: 'avatar.png', contentType: 'image/png' })
      .expect(401);
  });

  afterAll(async () => {
    await app.close();
  });
});
