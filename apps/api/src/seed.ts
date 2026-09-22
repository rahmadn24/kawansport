/**
 * Seed demo MVP KawanSport (SM-08).
 *
 * Isi: 3 users demo + 3 events sample + 1 conversation + pesan sample.
 * Idempotent: dijalankan ulang aman (upsert by email / judul).
 *
 * Cara pakai:
 *   cd apps/api && npm run seed
 *
 * Butuh Postgres jalan (docker compose up -d db redis) + DATABASE_URL valid.
 * JANGAN pakai DB_DRIVER=sqljs untuk seed (in-memory, hilang saat exit).
 */
import './env-preload';
import { NestFactory } from '@nestjs/core';
import * as bcrypt from 'bcryptjs';
import { DataSource } from 'typeorm';
import { Conversation, sortPair } from './chat/conversation.entity';
import { Message } from './chat/message.entity';
import { EventParticipant } from './events/event-participant.entity';
import { SportEvent, resolveEventStatus } from './events/event.entity';
import { User } from './users/user.entity';
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
    for (const d of DEMO_USERS) {
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
