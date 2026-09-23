/**
 * Seed demo MVP KawanSport (SM-08, diperluas REL-01 #72).
 *
 * Isi: 10 users demo (3 existing + 7 baru) + 6 events sample +
 * 4 venues approved (+courts) + 1 seller + 4 produk + 1 voucher aktif +
 * 5 ratings/reviews + loyalty points + 1 conversation + pesan sample.
 * Idempotent: dijalankan ulang aman (upsert by email / judul / nama / kode).
 *
 * Foto diambil dari docs/design/stitch-assets/MAP.json bila ada
 * (opsional — seed tetap jalan tanpa foto).
 *
 * Cara pakai:
 *   cd apps/api && npm run seed
 *
 * Butuh Postgres jalan (docker compose up -d db redis) + DATABASE_URL valid.
 * JANGAN pakai DB_DRIVER=sqljs untuk seed (in-memory, hilang saat exit).
 */
import './env-preload';
import * as fs from 'fs';
import * as path from 'path';
import { ConflictException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as bcrypt from 'bcryptjs';
import { DataSource, IsNull } from 'typeorm';
import { Conversation, sortPair } from './chat/conversation.entity';
import { Message } from './chat/message.entity';
import { EventParticipant } from './events/event-participant.entity';
import { SportEvent, resolveEventStatus } from './events/event.entity';
import { EventsService } from './events/events.service';
import { Seller } from './marketplace/seller.entity';
import { Product } from './marketplace/product.entity';
import { Rating } from './ratings/rating.entity';
import { Review } from './ratings/review.entity';
import { User, UserRole } from './users/user.entity';
import { Venue } from './venues/venue.entity';
import { Court } from './venues/court.entity';
import { Voucher } from './vouchers/voucher.entity';
import { AppModule } from './app.module';

const DEMO_PASSWORD = 'Demo1234!';

/** Akun super_admin CMS (AD-01). Didokumentasikan di README. */
const SUPER_ADMIN_EMAIL = 'admin@kawansport.id';
const SUPER_ADMIN_PASSWORD = 'Admin1234!';

const DEMO_USERS = [
  {
    email: 'andi@demo.id',
    displayName: 'Andi Demo',
    sports: ['futsal', 'badminton'],
    skillLevel: 'intermediate' as const,
    lat: -6.2,
    lng: 106.816666,
  },
  {
    email: 'budi@demo.id',
    displayName: 'Budi Demo',
    sports: ['futsal', 'basket'],
    skillLevel: 'beginner' as const,
    lat: -6.21,
    lng: 106.826666,
  },
  {
    email: 'cita@demo.id',
    displayName: 'Cita Demo',
    sports: ['badminton', 'lari'],
    skillLevel: 'advanced' as const,
    lat: -6.19,
    lng: 106.806666,
  },
];

/** 7 akun tambahan (REL-01): total 10 users + 1 super_admin. */
const EXTRA_DEMO_USERS: Array<{
  email: string;
  displayName: string;
  sports: string[];
  skillLevel: 'beginner' | 'intermediate' | 'advanced';
  role?: UserRole;
  lat: number;
  lng: number;
}> = [
  {
    email: 'dewi@demo.id',
    displayName: 'Dewi Demo',
    sports: ['badminton', 'lari'],
    skillLevel: 'intermediate',
    lat: -6.225,
    lng: 106.83,
  },
  {
    email: 'eko@demo.id',
    displayName: 'Eko Demo',
    sports: ['futsal'],
    skillLevel: 'beginner',
    lat: -6.23,
    lng: 106.84,
  },
  {
    email: 'farah@demo.id',
    displayName: 'Farah Demo',
    sports: ['basket', 'futsal'],
    skillLevel: 'advanced',
    lat: -6.2,
    lng: 106.81,
  },
  {
    email: 'gilang@demo.id',
    displayName: 'Gilang Demo',
    sports: ['badminton'],
    skillLevel: 'advanced',
    lat: -6.215,
    lng: 106.82,
  },
  {
    email: 'hana@demo.id',
    displayName: 'Hana Demo',
    sports: ['lari'],
    skillLevel: 'beginner',
    lat: -6.19,
    lng: 106.815,
  },
  {
    email: 'rian@demo.id',
    displayName: 'Rian Demo',
    sports: ['badminton', 'futsal'],
    skillLevel: 'intermediate',
    role: 'seller',
    lat: -6.21,
    lng: 106.82,
  },
  {
    email: 'sari@demo.id',
    displayName: 'Sari Demo',
    sports: ['badminton'],
    skillLevel: 'intermediate',
    role: 'venue_owner',
    lat: -6.218,
    lng: 106.803,
  },
];

/** Kategori foto dari docs/design/stitch-assets/MAP.json (opsional). */
type PhotoMap = {
  venue: string[];
  event: string[];
  product: string[];
  avatar: string[];
  other: string[];
};

function loadPhotoMap(): PhotoMap {
  const empty: PhotoMap = {
    venue: [],
    event: [],
    product: [],
    avatar: [],
    other: [],
  };
  const candidates = [
    path.resolve(__dirname, '../../../docs/design/stitch-assets/MAP.json'),
    path.resolve(process.cwd(), '../docs/design/stitch-assets/MAP.json'),
  ];
  for (const p of candidates) {
    try {
      const raw = JSON.parse(fs.readFileSync(p, 'utf8')) as Record<
        string,
        unknown
      >;
      (Object.keys(empty) as Array<keyof PhotoMap>).forEach((k) => {
        const arr = raw[k];
        empty[k] =
          Array.isArray(arr) && arr.length > 0
            ? (arr as unknown[]).filter(
                (u): u is string =>
                  typeof u === 'string' && u.startsWith('https://'),
              )
            : [];
      });
      return empty;
    } catch {
      // Lanjut ke kandidat berikut; foto opsional.
    }
  }
  return empty;
}

/** Ambil maksimal `n` foto kategori; rotasi offset agar tiap venue unik. */
function pickPhotos(list: string[], offset: number, n: number): string[] {
  if (list.length === 0 || n <= 0) return [];
  const out: string[] = [];
  for (let i = 0; i < n; i += 1) {
    out.push(list[(offset + i) % list.length]);
  }
  return [...new Set(out)];
}

/** Jam operasional seragam 06:00-23:00 untuk semua hari. */
function weekHours(range: string): Record<string, string[]> {
  return {
    mon: [range],
    tue: [range],
    wed: [range],
    thu: [range],
    fri: [range],
    sat: [range],
    sun: [range],
  };
}

async function syncUserLocation(
  ds: DataSource,
  userId: string,
  lat: number | null,
  lng: number | null,
): Promise<void> {
  const isPostgres = ds.options.type === 'postgres';
  if (lat == null || lng == null) {
    await ds.query(
      isPostgres
        ? 'UPDATE users SET location = NULL WHERE id = $1'
        : 'UPDATE users SET location = NULL WHERE id = ?',
      [userId],
    );
    return;
  }
  if (isPostgres) {
    await ds.query(
      'UPDATE users SET location = ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography WHERE id = $3',
      [lat, lng, userId],
    );
  } else {
    await ds.query('UPDATE users SET location = ? WHERE id = ?', [
      `POINT(${lng} ${lat})`,
      userId,
    ]);
  }
}

async function syncEventLocation(
  ds: DataSource,
  eventId: string,
  lat: number,
  lng: number,
): Promise<void> {
  if (ds.options.type === 'postgres') {
    await ds.query(
      'UPDATE events SET location = ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography WHERE id = $3',
      [lat, lng, eventId],
    );
  } else {
    await ds.query('UPDATE events SET location = ? WHERE id = ?', [
      `POINT(${lng} ${lat})`,
      eventId,
    ]);
  }
}

async function syncVenueLocation(
  ds: DataSource,
  venueId: string,
  lat: number,
  lng: number,
): Promise<void> {
  if (ds.options.type === 'postgres') {
    await ds.query(
      'UPDATE venues SET location = ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography WHERE id = $3',
      [lat, lng, venueId],
    );
  } else {
    await ds.query('UPDATE venues SET location = ? WHERE id = ?', [
      `POINT(${lng} ${lat})`,
      venueId,
    ]);
  }
}

async function main() {
  if (process.env.DB_DRIVER === 'sqljs') {
    // eslint-disable-next-line no-console
    console.error(
      'REFUSED: DB_DRIVER=sqljs adalah in-memory untuk test saja. Unset DB_DRIVER lalu jalankan seed ke Postgres.',
    );
    process.exit(1);
  }
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const ds = app.get(DataSource);
    const users = ds.getRepository(User);
    const events = ds.getRepository(SportEvent);
    const parts = ds.getRepository(EventParticipant);
    const convs = ds.getRepository(Conversation);
    const msgs = ds.getRepository(Message);
    const venues = ds.getRepository(Venue);
    const courts = ds.getRepository(Court);
    const sellers = ds.getRepository(Seller);
    const products = ds.getRepository(Product);
    const ratings = ds.getRepository(Rating);
    const reviews = ds.getRepository(Review);
    const vouchers = ds.getRepository(Voucher);
    const eventsService = app.get(EventsService, { strict: false });

    const PHOTOS = loadPhotoMap();

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
    const savedUsers: User[] = [];
    for (const d of DEMO_USERS) {
      const email = d.email.toLowerCase();
      let u = await users.findOne({ where: { email } });
      if (!u) {
        u = await users.save(
          users.create({
            email,
            passwordHash,
            displayName: d.displayName,
            sports: d.sports,
            skillLevel: d.skillLevel,
            lat: d.lat,
            lng: d.lng,
          }),
        );
        // eslint-disable-next-line no-console
        console.log(`+ user ${email}`);
      } else {
        u.passwordHash = passwordHash;
        u.displayName = d.displayName;
        u.sports = d.sports;
        u.skillLevel = d.skillLevel;
        u.lat = d.lat;
        u.lng = d.lng;
        await users.save(u);
        // eslint-disable-next-line no-console
        console.log(`~ user ${email} (reset password + profil)`);
      }
      await syncUserLocation(ds, u.id, d.lat, d.lng);
      savedUsers.push(u);
    }
    // Akun tambahan REL-01 — pola upsert sama; avatar dari MAP (bila ada).
    for (let i = 0; i < EXTRA_DEMO_USERS.length; i += 1) {
      const d = EXTRA_DEMO_USERS[i];
      const email = d.email.toLowerCase();
      const avatarUrl =
        PHOTOS.avatar.length > 0
          ? PHOTOS.avatar[i % PHOTOS.avatar.length]
          : null;
      let u = await users.findOne({ where: { email } });
      if (!u) {
        u = await users.save(
          users.create({
            email,
            passwordHash,
            displayName: d.displayName,
            sports: d.sports,
            skillLevel: d.skillLevel,
            role: d.role ?? 'user',
            avatarUrl,
            lat: d.lat,
            lng: d.lng,
          }),
        );
        // eslint-disable-next-line no-console
        console.log(`+ user ${email}`);
      } else {
        u.passwordHash = passwordHash;
        u.displayName = d.displayName;
        u.sports = d.sports;
        u.skillLevel = d.skillLevel;
        u.role = d.role ?? u.role;
        if (!u.avatarUrl) u.avatarUrl = avatarUrl;
        u.lat = d.lat;
        u.lng = d.lng;
        await users.save(u);
        // eslint-disable-next-line no-console
        console.log(`~ user ${email} (reset password + profil)`);
      }
      await syncUserLocation(ds, u.id, d.lat, d.lng);
      savedUsers.push(u);
    }
    // Super admin CMS (AD-01) — idempotent, password selalu di-reset.
    {
      const email = SUPER_ADMIN_EMAIL;
      const passwordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 10);
      let admin = await users.findOne({ where: { email } });
      if (!admin) {
        admin = await users.save(
          users.create({
            email,
            passwordHash,
            displayName: 'Super Admin',
            sports: [],
            role: 'super_admin',
          }),
        );
        // eslint-disable-next-line no-console
        console.log(`+ super_admin ${email}`);
      } else {
        admin.passwordHash = passwordHash;
        admin.displayName = 'Super Admin';
        admin.role = 'super_admin';
        await users.save(admin);
        // eslint-disable-next-line no-console
        console.log(`~ super_admin ${email} (reset password + role)`);
      }
    }
    const byEmail = Object.fromEntries(savedUsers.map((u) => [u.email, u]));
    const andi = byEmail['andi@demo.id'];
    const budi = byEmail['budi@demo.id'];
    const cita = byEmail['cita@demo.id'];

    const now = Date.now();
    const day = 86_400_000;
    const eventDefs = [
      {
        host: andi,
        sport: 'futsal',
        title: 'Futsal Santai Kuningan (Demo)',
        description: 'Fun futsal bareng, semua level welcome.',
        datetime: new Date(now + 2 * day),
        lat: -6.2,
        lng: 106.816666,
        capacity: 10,
        extraJoiners: [budi, cita],
      },
      {
        host: budi,
        sport: 'basket',
        title: 'Basket 3v3 Menteng (Demo)',
        description: 'Cari 4 orang lagi buat 3v3 sore.',
        datetime: new Date(now + 4 * day),
        lat: -6.21,
        lng: 106.826666,
        capacity: 6,
        extraJoiners: [andi],
      },
      {
        host: cita,
        sport: 'badminton',
        title: 'Badminton Ganda Tebet (Demo)',
        description: 'Sparing ganda pemula-menengah.',
        datetime: new Date(now + 6 * day),
        lat: -6.19,
        lng: 106.806666,
        capacity: 4,
        extraJoiners: [] as User[],
      },
    ];
    for (const def of eventDefs) {
      let e = await events.findOne({
        where: { title: def.title, hostId: def.host.id },
      });
      if (!e) {
        e = await events.save(
          events.create({
            hostId: def.host.id,
            sport: def.sport,
            title: def.title,
            description: def.description,
            datetime: def.datetime,
            lat: def.lat,
            lng: def.lng,
            capacity: def.capacity,
            participantsCount: 1,
            status: resolveEventStatus(1, def.capacity),
          }),
        );
        await parts.save(parts.create({ eventId: e.id, userId: def.host.id }));
        // eslint-disable-next-line no-console
        console.log(`+ event "${def.title}"`);
      }
      for (const j of def.extraJoiners) {
        const exists = await parts.findOne({
          where: { eventId: e.id, userId: j.id },
        });
        if (!exists) {
          await parts.save(parts.create({ eventId: e.id, userId: j.id }));
        }
      }
      const count = await parts.count({ where: { eventId: e.id } });
      e.participantsCount = count;
      e.status = resolveEventStatus(count, e.capacity);
      await events.save(e);
      await syncEventLocation(ds, e.id, e.lat, e.lng);
    }

    // ---- REL-01: venues + courts (owner: sari, status approved) ----
    const venueOwner = byEmail['sari@demo.id'];
    const VENUE_DEFS: Array<{
      name: string;
      address: string;
      lat: number;
      lng: number;
      sports: string[];
      courts: Array<{ name: string; sport: string; pricePerHour: number }>;
    }> = [
      {
        name: 'Arena Demo Senayan',
        address: 'Jl. Demo Senayan No. 1, Jakarta Selatan (Demo)',
        lat: -6.2186,
        lng: 106.8029,
        sports: ['badminton', 'futsal'],
        courts: [
          { name: 'Lapangan Badminton 1', sport: 'badminton', pricePerHour: 100000 },
          { name: 'Lapangan Futsal A', sport: 'futsal', pricePerHour: 200000 },
        ],
      },
      {
        name: 'Arena Demo Tebet',
        address: 'Jl. Demo Tebet No. 20, Jakarta Selatan (Demo)',
        lat: -6.2378,
        lng: 106.8539,
        sports: ['badminton'],
        courts: [
          { name: 'Lapangan Badminton 1', sport: 'badminton', pricePerHour: 80000 },
          { name: 'Lapangan Badminton 2', sport: 'badminton', pricePerHour: 90000 },
        ],
      },
      {
        name: 'Arena Demo Kelapa Gading',
        address: 'Jl. Demo Gading No. 5, Jakarta Utara (Demo)',
        lat: -6.1618,
        lng: 106.9065,
        sports: ['futsal', 'badminton'],
        courts: [
          { name: 'Lapangan Futsal A', sport: 'futsal', pricePerHour: 150000 },
          { name: 'Lapangan Badminton 1', sport: 'badminton', pricePerHour: 120000 },
          { name: 'Lapangan Badminton 2', sport: 'badminton', pricePerHour: 120000 },
        ],
      },
      {
        name: 'Arena Demo Depok',
        address: 'Jl. Demo Margonda No. 99, Depok (Demo)',
        lat: -6.4025,
        lng: 106.7942,
        sports: ['badminton', 'futsal'],
        courts: [
          { name: 'Lapangan Badminton 1', sport: 'badminton', pricePerHour: 80000 },
          { name: 'Lapangan Futsal A', sport: 'futsal', pricePerHour: 180000 },
        ],
      },
    ];
    const savedVenues: Venue[] = [];
    for (let vi = 0; vi < VENUE_DEFS.length; vi += 1) {
      const def = VENUE_DEFS[vi];
      const photos = pickPhotos(PHOTOS.venue, vi * 2, 3);
      let v = await venues.findOne({ where: { name: def.name } });
      if (!v) {
        v = await venues.save(
          venues.create({
            name: def.name,
            address: def.address,
            lat: def.lat,
            lng: def.lng,
            sports: def.sports,
            photos,
            ownerId: venueOwner.id,
            status: 'approved',
          }),
        );
        // eslint-disable-next-line no-console
        console.log(`+ venue "${def.name}"`);
      } else {
        v.address = def.address;
        v.lat = def.lat;
        v.lng = def.lng;
        v.sports = def.sports;
        v.photos = photos;
        v.ownerId = venueOwner.id;
        v.status = 'approved';
        v.rejectionReason = null;
        await venues.save(v);
        // eslint-disable-next-line no-console
        console.log(`~ venue "${def.name}"`);
      }
      await syncVenueLocation(ds, v.id, v.lat, v.lng);
      for (const cdef of def.courts) {
        const openHours = weekHours('06:00-23:00');
        const existing = await courts.findOne({
          where: { venueId: v.id, name: cdef.name },
        });
        if (!existing) {
          await courts.save(
            courts.create({
              venueId: v.id,
              name: cdef.name,
              sport: cdef.sport,
              pricePerHour: cdef.pricePerHour,
              openHours,
              status: 'active',
            }),
          );
          // eslint-disable-next-line no-console
          console.log(`+ court "${def.name} / ${cdef.name}"`);
        } else {
          existing.sport = cdef.sport;
          existing.pricePerHour = cdef.pricePerHour;
          existing.openHours = openHours;
          existing.status = 'active';
          await courts.save(existing);
        }
      }
      savedVenues.push(v);
    }
    const venueByName = Object.fromEntries(savedVenues.map((x) => [x.name, x]));

    // ---- REL-01: 3 events aktif (tanggal masa depan, join via service) ----
    const extraEventDefs: Array<{
      host: User;
      sport: string;
      title: string;
      description: string;
      daysAhead: number;
      lat: number;
      lng: number;
      capacity: number;
      extraJoiners: User[];
    }> = [
      {
        host: byEmail['gilang@demo.id'],
        sport: 'badminton',
        title: 'Badminton Ganda Santai Demo',
        description: 'Sparing ganda santai, level menengah. Bawa raket sendiri ya.',
        daysAhead: 1,
        lat: -6.215,
        lng: 106.82,
        capacity: 4,
        extraJoiners: [byEmail['dewi@demo.id'], byEmail['andi@demo.id']],
      },
      {
        host: byEmail['eko@demo.id'],
        sport: 'futsal',
        title: 'Futsal 5v5 Seru Demo',
        description: 'Fun game 5 lawan 5, butuh 6 orang lagi. Patungan sewa lapangan.',
        daysAhead: 2,
        lat: -6.23,
        lng: 106.84,
        capacity: 10,
        extraJoiners: [
          byEmail['budi@demo.id'],
          byEmail['farah@demo.id'],
          byEmail['andi@demo.id'],
        ],
      },
      {
        host: byEmail['hana@demo.id'],
        sport: 'lari',
        title: 'Lari Pagi CFD Demo',
        description: 'Easy run 5K bareng, semua pace welcome. Titik kumpul di pintu masuk.',
        daysAhead: 3,
        lat: -6.19,
        lng: 106.815,
        capacity: 20,
        extraJoiners: [byEmail['cita@demo.id'], byEmail['dewi@demo.id']],
      },
    ];
    for (let ei = 0; ei < extraEventDefs.length; ei += 1) {
      const def = extraEventDefs[ei];
      let e = await events.findOne({
        where: { title: def.title, hostId: def.host.id },
      });
      if (!e) {
        e = await events.save(
          events.create({
            hostId: def.host.id,
            sport: def.sport,
            title: def.title,
            description: def.description,
            datetime: new Date(now + def.daysAhead * day),
            lat: def.lat,
            lng: def.lng,
            capacity: def.capacity,
            photos: pickPhotos(PHOTOS.event, ei, 1),
            participantsCount: 1,
            status: resolveEventStatus(1, def.capacity),
          }),
        );
        await parts.save(parts.create({ eventId: e.id, userId: def.host.id }));
        // eslint-disable-next-line no-console
        console.log(`+ event "${def.title}"`);
      }
      for (const j of def.extraJoiners) {
        try {
          await eventsService.join(e.id, j.id);
        } catch (err) {
          if (err instanceof ConflictException) {
            // Sudah join (run ulang) — lewati, idempotent.
          } else {
            throw err;
          }
        }
      }
      const recount = await parts.count({ where: { eventId: e.id } });
      e.participantsCount = recount;
      e.status = resolveEventStatus(recount, e.capacity);
      await events.save(e);
      await syncEventLocation(ds, e.id, e.lat, e.lng);
    }

    // ---- REL-01: marketplace (1 seller approved + 4 produk tampil) ----
    const sellerOwner = byEmail['rian@demo.id'];
    let seller = await sellers.findOne({
      where: { ownerId: sellerOwner.id },
    });
    if (!seller) {
      seller = await sellers.save(
        sellers.create({
          ownerId: sellerOwner.id,
          shopName: 'Toko Sport Demo',
          description: 'Peralatan olahraga buat kawan mabar (toko demo).',
          status: 'approved',
        }),
      );
      // eslint-disable-next-line no-console
      console.log('+ seller "Toko Sport Demo"');
    } else {
      seller.shopName = 'Toko Sport Demo';
      seller.description = 'Peralatan olahraga buat kawan mabar (toko demo).';
      seller.status = 'approved';
      seller.rejectionReason = null;
      await sellers.save(seller);
      // eslint-disable-next-line no-console
      console.log('~ seller "Toko Sport Demo"');
    }
    if (sellerOwner.role !== 'seller') {
      sellerOwner.role = 'seller';
      await users.save(sellerOwner);
    }
    const PRODUCT_DEFS: Array<{
      name: string;
      category: string;
      description: string;
      price: number;
      stock: number;
      photoOffset: number | null;
    }> = [
      {
        name: 'Raket Badminton Pro Demo',
        category: 'raket',
        description: 'Raket ringan 4U buat sparing, sudah termasuk senar (demo).',
        price: 450000,
        stock: 15,
        photoOffset: 0,
      },
      {
        name: 'Sepatu Futsal Speed Demo',
        category: 'sepatu',
        description: 'Sepatu futsal ringan, grip mantap di lapangan sintetis (demo).',
        price: 550000,
        stock: 20,
        photoOffset: 1,
      },
      {
        name: 'Shuttlecock Tournament Demo',
        category: 'shuttlecock',
        description: 'Shuttlecock bulu angsa, laju stabil buat turnamen (demo).',
        price: 120000,
        stock: 50,
        photoOffset: 2,
      },
      {
        name: 'Jersey Dryfit Demo',
        category: 'jersey',
        description: 'Jersey dryfit adem buat mabar (demo, tanpa foto).',
        price: 150000,
        stock: 30,
        photoOffset: null,
      },
    ];
    for (const def of PRODUCT_DEFS) {
      // MAP tak punya foto jersey -> produk jersey tanpa foto (jujur, bukan comot).
      const photos =
        def.photoOffset != null
          ? pickPhotos(PHOTOS.product, def.photoOffset, 1)
          : [];
      const existing = await products.findOne({
        where: { sellerId: seller.id, name: def.name },
      });
      if (!existing) {
        await products.save(
          products.create({
            sellerId: seller.id,
            category: def.category,
            name: def.name,
            description: def.description,
            price: def.price,
            stock: def.stock,
            photos,
            status: 'approved',
          }),
        );
        // eslint-disable-next-line no-console
        console.log(`+ product "${def.name}"`);
      } else {
        existing.category = def.category;
        existing.description = def.description;
        existing.price = def.price;
        existing.stock = def.stock;
        existing.photos = photos;
        existing.status = 'approved';
        existing.rejectionReason = null;
        await products.save(existing);
        // eslint-disable-next-line no-console
        console.log(`~ product "${def.name}"`);
      }
    }

    // ---- REL-01: voucher aktif HEMAT20 (percent 20, max 50rb, quota 100) ----
    {
      const validFrom = new Date();
      const validTo = new Date(validFrom.getTime() + 30 * day);
      let voucher = await vouchers.findOne({ where: { code: 'HEMAT20' } });
      if (!voucher) {
        await vouchers.save(
          vouchers.create({
            code: 'HEMAT20',
            type: 'percent',
            value: 20,
            maxDiscount: 50000,
            minTransaction: 0,
            quota: 100,
            perUserLimit: null,
            usedCount: 0,
            validFrom,
            validTo,
            applicableTo: 'all',
            active: true,
          }),
        );
        // eslint-disable-next-line no-console
        console.log('+ voucher HEMAT20');
      } else {
        voucher.type = 'percent';
        voucher.value = 20;
        voucher.maxDiscount = 50000;
        voucher.minTransaction = 0;
        voucher.quota = 100;
        voucher.applicableTo = 'all';
        voucher.active = true;
        voucher.validFrom = validFrom;
        voucher.validTo = validTo;
        // usedCount SENGAJA dipertahankan (jejak redeem riil).
        await vouchers.save(voucher);
        // eslint-disable-next-line no-console
        console.log('~ voucher HEMAT20');
      }
    }

    // ---- REL-01: ratings + reviews tersebar di venue ----
    const RATING_DEFS: Array<{
      userEmail: string;
      venueName: string;
      score: number;
      comment: string;
      photoOffset: number | null;
    }> = [
      {
        userEmail: 'andi@demo.id',
        venueName: 'Arena Demo Senayan',
        score: 5,
        comment:
          'Lapangannya bagus banget, matras empuk dan lampunya terang. Pasti balik lagi!',
        photoOffset: null,
      },
      {
        userEmail: 'dewi@demo.id',
        venueName: 'Arena Demo Senayan',
        score: 4,
        comment:
          'Tempatnya bersih dan parkirnya luas. Cuma agak ramai kalau weekend.',
        photoOffset: null,
      },
      {
        userEmail: 'budi@demo.id',
        venueName: 'Arena Demo Tebet',
        score: 5,
        comment:
          'Harga bersahabat, booking-nya gampang, penjaganya ramah. Recommended!',
        photoOffset: 0,
      },
      {
        userEmail: 'cita@demo.id',
        venueName: 'Arena Demo Kelapa Gading',
        score: 4,
        comment:
          'Fasilitasnya lengkap, ruang gantinya bersih. Lapangan futsalnya mantap.',
        photoOffset: 2,
      },
      {
        userEmail: 'eko@demo.id',
        venueName: 'Arena Demo Depok',
        score: 3,
        comment:
          'Lapangannya oke, tapi toiletnya kurang bersih. Semoga cepat diperbaiki.',
        photoOffset: null,
      },
    ];
    for (const def of RATING_DEFS) {
      const rater = byEmail[def.userEmail];
      const venue = venueByName[def.venueName];
      let r = await ratings.findOne({
        where: { userId: rater.id, venueId: venue.id, courtId: IsNull() },
      });
      if (!r) {
        r = await ratings.save(
          ratings.create({
            userId: rater.id,
            venueId: venue.id,
            courtId: null,
            score: def.score,
          }),
        );
        // eslint-disable-next-line no-console
        console.log(`+ rating ${def.userEmail} -> ${def.venueName} (${def.score})`);
      } else if (r.score !== def.score) {
        r.score = def.score;
        await ratings.save(r);
      }
      const reviewPhotos =
        def.photoOffset != null
          ? pickPhotos(PHOTOS.venue, def.photoOffset, 1)
          : [];
      const rev = await reviews.findOne({ where: { ratingId: r.id } });
      if (!rev) {
        await reviews.save(
          reviews.create({
            ratingId: r.id,
            comment: def.comment,
            photos: reviewPhotos,
          }),
        );
        // eslint-disable-next-line no-console
        console.log(`+ review ${def.userEmail} -> ${def.venueName}`);
      } else {
        rev.comment = def.comment;
        rev.photos = reviewPhotos;
        await reviews.save(rev);
      }
    }

    // ---- REL-01: saldo loyalty demo (agar UI poin terlihat) ----
    const LOYALTY_TOPUP: Array<[string, number]> = [
      ['andi@demo.id', 150],
      ['dewi@demo.id', 50],
    ];
    for (const [email, points] of LOYALTY_TOPUP) {
      const u = byEmail[email];
      if (u.loyaltyPoints !== points) {
        u.loyaltyPoints = points;
        await users.save(u);
        // eslint-disable-next-line no-console
        console.log(`~ loyalty ${email} = ${points}`);
      }
    }

    // Conversation sample Andi <-> Budi + 3 pesan.
    const [userA, userB] = sortPair(andi.id, budi.id);
    let conv = await convs.findOne({ where: { userA, userB } });
    if (!conv) {
      conv = await convs.save(convs.create({ userA, userB }));
      // eslint-disable-next-line no-console
      console.log('+ conversation Andi <-> Budi');
    }
    const existingMsgs = await msgs.count({
      where: { conversationId: conv.id },
    });
    if (existingMsgs === 0) {
      const seedMsgs: Array<{ senderId: string; body: string }> = [
        { senderId: andi.id, body: 'Halo Budi! Ikut futsal santai besok?' },
        { senderId: budi.id, body: 'Halo Andi! Bisa, jam berapa kumpulnya?' },
        {
          senderId: andi.id,
          body: 'Jam 19.00 di Kuningan ya, aku sudah booking lapangan.',
        },
      ];
      for (const m of seedMsgs) {
        await msgs.save(
          msgs.create({ conversationId: conv.id, senderId: m.senderId, body: m.body }),
        );
      }
      const last = await msgs.findOne({
        where: { conversationId: conv.id },
        order: { createdAt: 'DESC' },
      });
      if (last) {
        conv.lastMessageAt = last.createdAt;
        await convs.save(conv);
      }
      // eslint-disable-next-line no-console
      console.log('+ 3 pesan sample');
    } else {
      // eslint-disable-next-line no-console
      console.log(`~ conversation sudah punya ${existingMsgs} pesan, dilewati`);
    }

    // eslint-disable-next-line no-console
    console.log('\nSeed OK. Akun demo (password semua: Demo1234!):');
    for (const d of [...DEMO_USERS, ...EXTRA_DEMO_USERS]) {
      // eslint-disable-next-line no-console
      console.log(`  - ${d.email} / ${DEMO_PASSWORD}`);
    }
    // eslint-disable-next-line no-console
    console.log(`  - ${SUPER_ADMIN_EMAIL} / ${SUPER_ADMIN_PASSWORD} (super_admin, AD-01)`);
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('Seed gagal:', e?.message ?? e);
  process.exit(1);
});
