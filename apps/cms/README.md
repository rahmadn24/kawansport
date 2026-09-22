# KawanSport CMS (AD-01)

Next.js + TypeScript — dashboard skeleton per role (admin / venue_owner / seller).

## Run

```bash
cd apps/cms
npm install
npm run dev     # http://localhost:3001
```

API basis: `NEXT_PUBLIC_API_URL` (default `http://localhost:3000`, lihat `.env.example`).

## Alur

1. `/` — login via API JWT (`POST /auth/login`), token disimpan di `localStorage`
   (`cms.accessToken` / `cms.refreshToken`).
2. Role dibaca dari `GET /me`, redirect otomatis:
   `super_admin` → `/dashboard/admin`, `venue_owner` → `/dashboard/owner`,
   `seller` → `/dashboard/seller`, `user` → `/dashboard`.
3. Tiap halaman dashboard memakai `RoleGuard` (guard route client) — role tak
   sesuai → 403 di client. `super_admin` selalu lolos guard client, sama
   seperti helper server.
4. `/dashboard/admin` memanggil `GET /admin/ping` sebagai bukti guard server
   (hanya super_admin → 200, role lain 403).

Akun admin seed: `admin@kawansport.id` / `Admin1234!` (lihat README root + `apps/api/src/seed.ts`).

## Verifikasi

```bash
npm run typecheck  # tsc --noEmit, harus no error
npm run build      # next build, harus sukses
```
