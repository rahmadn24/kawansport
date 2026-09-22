# KawanSport — main bareng, naik level

KawanSport adalah platform olahraga sosial: cari lawan yang setara,
booking lapangan secara real-time, ikut event & liga, dan belanja gear —
untuk pemain dan venue dalam satu ekosistem.

## Struktur monorepo

| Folder | Stack | Peran |
|--------|-------|-------|
| `apps/api` | NestJS 10 + TypeORM + PostgreSQL/PostGIS + Redis | REST API + WebSocket (chat realtime), auth JWT, push notification via FCM HTTP v1 native |
| `apps/mobile` | React Native bare CLI + TypeScript (tanpa Expo) | Aplikasi Android/iOS |
| `apps/cms` | Next.js 14 + TypeScript | Dashboard admin, venue owner, dan seller (RBAC) |
| `apps/landing` | Next.js + TypeScript | Landing page publik |

Infrastruktur: `docker-compose.yml` (PostgreSQL+PostGIS, Redis, API, CMS, landing).
Mobile berjalan di host/emulator, tidak di-docker-kan.

## Quickstart

```bash
cp .env.example .env   # hanya bila file .env belum ada
./start.sh              # naikkan semua service + seed akun demo
```

`./start.sh` menunggu API healthy lalu menjalankan seed database (idempotent,
aman diulang). Matikan dengan `docker compose down`.

| Service | URL | Keterangan |
|---------|-----|------------|
| API | http://localhost:3000 | Cek: `GET /health` |
| CMS | http://localhost:3001 | Login sebagai super_admin hasil seed: `admin@kawansport.id` (password dibuat saat seeding, wajib diganti di produksi) |
| Landing | http://localhost:3002 | Halaman publik |

## Konfigurasi

```bash
cp .env.example .env
```

Semua variabel terdokumentasi di `.env.example` (koneksi database/Redis,
JWT, upload avatar, Midtrans sandbox, mode push). Nilai di `.env` tidak
pernah di-commit (lihat `.gitignore`).

**Firebase / push notification (FCM HTTP v1, native — tanpa Expo):**

- Android: taruh file dari Firebase Console di
  `apps/mobile/android/app/google-services.json` (jangan di-commit,
  hanya `*.example` yang tercatat git).
- iOS: taruh `GoogleService-Info.plist` di folder iOS yang ditentukan.
- Backend berjalan mode stub secara default (pengiriman hanya di-log,
  tanpa kredensial). Untuk produksi, nonaktifkan stub dan sediakan
  service account via variabel env (inline JSON atau path file) —
  tanpa menaruh nilai rahasia di repo.

## Status modul

- Auth (register/login, JWT access + refresh rotasi), profil + avatar upload.
- Event + geo (PostGIS), partisipan join/leave, pencarian partner + jarak.
- Chat 1-on-1 realtime via WebSocket.
- RBAC (`super_admin`, `venue_owner`, `seller`, `user`) + CMS per-role.
- Venue + booking, marketplace, rating, change-request.
- Notifikasi push native via FCM (stub default, siap produksi).

Detail endpoint: [`apps/api/ENDPOINTS.md`](apps/api/ENDPOINTS.md).
Panduan CMS: [`apps/cms/README.md`](apps/cms/README.md).
