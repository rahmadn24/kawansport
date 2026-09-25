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

describe('Ratings ST-06 rich review (e2e)', () => {
  let app: INestApplication;
  let users: Repository<User>;
  const ts = Date.now();
  const password = 'Password123!';

  let ownerToken: string;
  let userAToken: string;
  let userBToken: string;
  let adminToken: string;
  let reviewerName: string;

  let venueId: string;

  const authOwner = () => ({ Authorization: `Bearer ${ownerToken}` });
  const authA = () => ({ Authorization: `Bearer ${userAToken}` });
  const authB = () => ({ Authorization: `Bearer ${userBToken}` });
  const authAdmin = () => ({ Authorization: `Bearer ${adminToken}` });

  const newVenue = async (name: string): Promise<string> => {
    const v = await request(app.getHttpServer())
      .post('/venues')
      .set(authOwner())
      .send({
        name,
        address: 'Jl. ST06 No. 1',
        lat: -6.2,
        lng: 106.8,
        sports: ['Futsal'],
      })
      .expect(201);
    return v.body.id as string;
  };

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
      .send({ email: `st06_owner_${ts}@example.com`, password })
      .expect(201);
    await users.update({ id: regOwner.body.user.id }, { role: 'venue_owner' });
    ownerToken = (
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: `st06_owner_${ts}@example.com`, password })
        .expect(200)
    ).body.accessToken;

    reviewerName = 'Reviewer ST06';
    const regA = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `st06_usera_${ts}@example.com`,
        password,
        displayName: reviewerName,
      })
      .expect(201);
    userAToken = regA.body.accessToken;

    userBToken = (
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: `st06_userb_${ts}@example.com`, password })
        .expect(201)
    ).body.accessToken;

    const regAdmin = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `st06_admin_${ts}@example.com`, password })
      .expect(201);
    await users.update({ id: regAdmin.body.user.id }, { role: 'super_admin' });
    adminToken = (
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: `st06_admin_${ts}@example.com`, password })
        .expect(200)
    ).body.accessToken;

    venueId = await newVenue('GOR ST06');
    await request(app.getHttpServer())
      .post(`/venues/${venueId}/approve`)
      .set(authAdmin())
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('aspek parsial OK: hanya 2 dari 4 aspek -> 201 + terbaca di detail/list', async () => {
    const v = await newVenue('GOR ST06 Aspek');
    const created = await request(app.getHttpServer())
      .post('/ratings')
      .set(authA())
      .send({ venueId: v, score: 4, aspects: { lapangan: 5, bersih: 3 } })
      .expect(201);
    expect(created.body.review).toMatchObject({
      aspects: { lapangan: 5, bersih: 3 },
    });

    const detail = await request(app.getHttpServer())
      .get(`/ratings/${created.body.id}`)
      .expect(200);
    expect(detail.body.review.aspects).toEqual({ lapangan: 5, bersih: 3 });

    const list = await request(app.getHttpServer())
      .get(`/ratings/venues/${v}/ratings`)
      .expect(200);
    expect(list.body.data[0].review.aspects).toEqual({
      lapangan: 5,
      bersih: 3,
    });
  });

  it('aspek invalid -> 400 (nilai 0/6); kunci asing diabaikan (whitelist)', async () => {
    const v = await newVenue('GOR ST06 Aspek Invalid');
    await request(app.getHttpServer())
      .post('/ratings')
      .set(authA())
      .send({ venueId: v, score: 4, aspects: { lapangan: 6 } })
      .expect(400);
    await request(app.getHttpServer())
      .post('/ratings')
      .set(authA())
      .send({ venueId: v, score: 4, aspects: { cahaya: 0 } })
      .expect(400);
    // Kunci di luar {lapangan,cahaya,bersih,staf} di-strip oleh
    // ValidationPipe whitelist (konvensi global API) -> rating tersimpan
    // tanpa aspek (bukan 400).
    const stripped = await request(app.getHttpServer())
      .post('/ratings')
      .set(authA())
      .send({ venueId: v, score: 4, aspects: { parkir: 5 } })
      .expect(201);
    expect(stripped.body.review).toBeNull();
  });

  it('tags dinormalisasi lowercase-trim + dedupe; over-limit -> 400', async () => {
    const v = await newVenue('GOR ST06 Tags');
    const created = await request(app.getHttpServer())
      .post('/ratings')
      .set(authA())
      .send({
        venueId: v,
        score: 5,
        comment: 'Mantap',
        tags: [' Bersih ', 'BERSIH', 'Murah'],
      })
      .expect(201);
    expect(created.body.review.tags).toEqual(['bersih', 'murah']);

    // >5 tag -> 400.
    const v2 = await newVenue('GOR ST06 Tags Limit');
    await request(app.getHttpServer())
      .post('/ratings')
      .set(authA())
      .send({
        venueId: v2,
        score: 5,
        tags: ['a', 'b', 'c', 'd', 'e', 'f'],
      })
      .expect(400);
    // Tag >30 char -> 400.
    await request(app.getHttpServer())
      .post('/ratings')
      .set(authA())
      .send({ venueId: v2, score: 5, tags: ['x'.repeat(31)] })
      .expect(400);
  });

  it('anonim: publik tersamar, owner + admin lihat asli', async () => {
    const v = await newVenue('GOR ST06 Anonim');
    const created = await request(app.getHttpServer())
      .post('/ratings')
      .set(authA())
      .send({ venueId: v, score: 5, comment: 'Rahasia', isAnonymous: true })
      .expect(201);
    const id = created.body.id as string;
    expect(created.body.review.isAnonymous).toBe(true);
    // Owner langsung lihat asli dari respons create.
    expect(created.body.user.displayName).toBe(reviewerName);

    // Publik tanpa token -> tersamar.
    const pub = await request(app.getHttpServer())
      .get(`/ratings/${id}`)
      .expect(200);
    expect(pub.body.user.displayName).toBe('Anonim');
    expect(pub.body.user.avatarUrl).toBeNull();
    expect(pub.body.review.isAnonymous).toBe(true);

    // Orang lain (B) dengan token -> tetap tersamar.
    const pubB = await request(app.getHttpServer())
      .get(`/ratings/${id}`)
      .set(authB())
      .expect(200);
    expect(pubB.body.user.displayName).toBe('Anonim');
    expect(pubB.body.user.avatarUrl).toBeNull();

    // Owner review -> lihat asli.
    const own = await request(app.getHttpServer())
      .get(`/ratings/${id}`)
      .set(authA())
      .expect(200);
    expect(own.body.user.displayName).toBe(reviewerName);

    // Admin -> lihat asli.
    const adm = await request(app.getHttpServer())
      .get(`/ratings/${id}`)
      .set(authAdmin())
      .expect(200);
    expect(adm.body.user.displayName).toBe(reviewerName);

    // List publik ikut tersamar; list dengan token owner ikut asli.
    const listPub = await request(app.getHttpServer())
      .get(`/ratings/venues/${v}/ratings`)
      .expect(200);
    expect(listPub.body.data[0].user.displayName).toBe('Anonim');
    const listOwn = await request(app.getHttpServer())
      .get(`/ratings/venues/${v}/ratings`)
      .set(authA())
      .expect(200);
    expect(listOwn.body.data[0].user.displayName).toBe(reviewerName);
  });

  it('update: ganti aspek/tags/anonim; kosongkan semua -> review terhapus', async () => {
    const v = await newVenue('GOR ST06 Update');
    const created = await request(app.getHttpServer())
      .post('/ratings')
      .set(authB())
      .send({
        venueId: v,
        score: 3,
        aspects: { staf: 2 },
        tags: ['ramai'],
      })
      .expect(201);
    const id = created.body.id as string;

    const updated = await request(app.getHttpServer())
      .put(`/ratings/${id}`)
      .set(authB())
      .send({
        aspects: { staf: 4, cahaya: 5 },
        tags: [' Sepi '],
        isAnonymous: true,
      })
      .expect(200);
    expect(updated.body.review.aspects).toEqual({ staf: 4, cahaya: 5 });
    expect(updated.body.review.tags).toEqual(['sepi']);
    expect(updated.body.review.isAnonymous).toBe(true);

    // Kosongkan semua (comment kosong + tags kosong + aspects null + anonim false).
    const cleared = await request(app.getHttpServer())
      .put(`/ratings/${id}`)
      .set(authB())
      .send({ comment: '  ', tags: [], aspects: null, isAnonymous: false })
      .expect(200);
    expect(cleared.body.review).toBeNull();
  });
});
