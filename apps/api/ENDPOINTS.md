# KawanSport API — Daftar Endpoint (MVP SM-01..SM-07 + AD-01 + BK-01..BK-03)

Base URL dev: `http://localhost:3000` (env `API_PORT`, prefix kosong — lihat `API_PREFIX` bila di-set).
Auth (kecuali `GET /health` dan `POST /auth/*`): header `Authorization: Bearer <accessToken>`.

Ringkasan per SM:

| SM | Fitur | Endpoint utama |
|----|-------|----------------|
| SM-01 | Setup monorepo + health | `GET /health` |
| SM-02 | Auth register/login/refresh/logout | `POST /auth/*`, `GET /me` |
| SM-03 | Profil + avatar | `GET/PATCH /me`, `POST /me/avatar`, file di `GET /uploads/...` |
| SM-04 | Event create + list geo | `POST /events`, `GET /events` |
| SM-05 | Join/leave + peserta | `POST /events/:id/join`, `POST /events/:id/leave`, `GET /events/:id[/participants]` |
| SM-06 | Cari partner sparing | `GET /users/search` |
| SM-07 | Chat 1-1 (REST + WS) | `POST/GET /conversations`, `GET /conversations/:id/messages`, `POST /conversations/:id/read`, WS `join` / `message:send` |
| AD-01 | RBAC + CMS | `GET /admin/ping` (super_admin), `role` di semua response user |
| AD-02 | CMS approval + edit-butuh-approve | `GET /me/change-requests`, `GET /admin/change-requests?status=` + approve/reject, `PATCH` sensitif atas approved → 202 CR, `GET /admin/{venues,products,sellers,users,bookings,orders}` |
| BK-02 | Slot availability + hold anti-race | `GET /courts/:id/availability`, `POST /courts/:id/hold`, `POST /holds/:id/release` |
| BK-03 | Booking + Midtrans sandbox + webhook | `POST /bookings`, `GET /bookings/me`, `GET /bookings/:id`, `POST /bookings/:id/cancel`, `POST /payments/midtrans/notification` |
| MP-01 | Seller onboarding + produk approval | `POST/GET /sellers[/me|/pending|/:id/approve|/:id/reject]`, `POST/GET/PATCH /products[/pending|/:id|/:id/approve|/:id/reject]` |
| MP-02 | Cart multiseller + checkout + orders per seller | `GET/PUT /cart`, `POST /checkout`, `GET /orders/me`, `GET /orders/:id` (webhook sama `POST /payments/midtrans/notification`, prefix `MP-`) |

## Health

### `GET /health`
Tanpa auth. Response: `{ status: "ok", service: "kawansport-api", timestamp }`.

## Auth (SM-02)

### `POST /auth/register`
Body: `{ email, password (min 8), displayName? }`.
- 201: `{ user, accessToken, refreshToken }`. User baru selalu `role: "user"`.
- 409 bila email sudah terdaftar.

### `POST /auth/login`
Body: `{ email, password }`.
- 200: `{ user, accessToken, refreshToken }` (`user.role` + klaim `role` di access JWT).
- 401 bila kredensial salah.

### `POST /auth/refresh`
Body: `{ refreshToken }`. Rotasi: token lama langsung hangus.
- 200: `{ accessToken, refreshToken }` (pasangan baru).
- 401 bila token tidak dikenal / sudah dicabut / kedaluwarsa.

### `POST /auth/logout`
Body: `{ refreshToken }`. Idempotent — selalu 200 `{ ok: true }` walau token tidak dikenal.

Token: access JWT `JWT_ACCESS_TTL` (default `15m`), refresh JWT `JWT_REFRESH_TTL` (default `7d`, hash sha256 tersimpan di DB).

## Profil (SM-03, auth)

### `GET /me`
Response profil publik: `id, email, displayName, role, sports[], skillLevel, lat, lng, avatarUrl, loyaltyPoints, createdAt, updatedAt`.
`role`: `super_admin | venue_owner | seller | user` (default `user`).
`loyaltyPoints`: saldo Poin Kawan (ST-04, default 0; +50 per review, 1 poin = Rp1 saat redeem).

### `PATCH /me`
Body parsial: `{ displayName?, sports? (maks 20 × 40 char), skillLevel? (beginner|intermediate|advanced), lat?+lng? }`.
- `lat`/`lng` wajib berpasangan; `null`+`null` = hapus lokasi; di luar rentang → 400.
- Kolom `location` (PostGIS `geography(Point,4326)`) diturunkan otomatis di server.

### `POST /me/avatar`
Multipart `avatar` (jpeg/png/webp/gif, maks `AVATAR_MAX_MB`, default 2 MB).
- 201: `{ avatarUrl }`, mis. `/uploads/avatars/<uuid>.png`.
- File diserve statis: `GET /uploads/avatars/<file>`.

## Events (SM-04 + SM-05, auth)

### `POST /events`
Body: `{ sport (≤60), title (≤120), description?, datetime (ISO, masa depan), lat, lng, capacity (≥2) }`.
Host = user dari JWT dan otomatis jadi peserta #1 (`participantsCount=1`, `status` dihitung `open/full`).

### `GET /events`
Query: `sport?, from?, to?, lat?+lng? (berpasangan), radius? (meter, default 10000), page? (default 1), limit? (default 20)`.
Sort `datetime` ASC. Response `{ data: EventListItem[], meta: { page, limit, total } }`.
`EventListItem`: `id, sport, title, description, datetime, lat, lng, capacity, participantsCount, status, host{id,email,displayName,avatarUrl}, distanceMeters? (bila geo), createdAt, updatedAt`.

### `GET /events/:id`
Detail + `host` + `isJoined` milik current user. 404 bila tidak ada.

### `GET /events/:id/participants`
`{ data: [{ userId, email, displayName, avatarUrl, joinedAt }], meta: { total } }`, urut `joinedAt` ASC.

### `POST /events/:id/join`
- 201: detail event + `isJoined: true`.
- 409 bila sudah join / event penuh. Transaksional anti-race.

### `POST /events/:id/leave`
- 200: detail event + `isJoined: false`.
- 404 bila bukan peserta.

## Users (SM-06, auth)

### `GET /users/search`
Cari partner sparing. Selalu exclude diri sendiri.
Query: `sport? (overlap satu item, case-insensitive), skill? (beginner|intermediate|advanced), lat?+lng? (berpasangan), radius? (default 10000), page?, limit?`.
- Dengan geo: hanya user ber-lokasi dalam radius, sort jarak ASC, tiap item ada `distanceMeters`.
- Tanpa geo: sort `createdAt` ASC.
- Response `{ data: UserSearchItem[], meta: { page, limit, total } }`.

## Chat 1-1 (SM-07, auth)

Pasangan user selalu disimpan terurut + unique constraint, sehingga `(A,B) == (B,A)`.

### `POST /conversations`
Body: `{ partnerId }`. Get-or-create. 400 bila chat dengan diri sendiri, 404 bila partner tidak ada.
Response `ConversationItem`: `{ id, partner{id,email,displayName,avatarUrl}, lastMessage|null, unreadCount, lastMessageAt, createdAt, updatedAt }`.

### `GET /conversations`
List milik current user, sort `lastMessageAt` DESC (belum ada pesan = paling bawah). `{ data: ConversationItem[] }`.

### `GET /conversations/:id/messages`
Query `page? (default 1), limit? (default 20)`. History ASC + `{ data: MessageItem[], meta: { page, limit, total } }`.
`MessageItem`: `{ id, conversationId, senderId, body, createdAt, readAt }`. 403 bila bukan anggota.

### `POST /conversations/:id/read`
Tandai semua pesan lawan sebagai dibaca. 200 `{ ok: true, marked: N }`.

### WebSocket (Socket.io, path default `/socket.io`)
Auth: JWT access token via `handshake.auth.token` (atau `handshake.query.token`). Tanpa token valid koneksi ditolak.
- client → `join { conversationId }` → server `{ ok, conversationId }` (verifikasi membership dulu).
- client → `message:send { conversationId, body (1..2000 char) }` → persist + broadcast `message:new` (isi `MessageItem`) ke room conversation + `conversation:update { conversationId, lastMessage, unreadCount }` ke personal room kedua user.
- server → `message:new`, server → `conversation:update`.

## Kode status yang dipakai
`200` OK (login/refresh/logout/leave/read), `201` Created (register/join/message via WS ack), `400` validasi, `401` auth, `403` bukan anggota conversation, `404` resource/user bukan peserta, `409` duplikat (email / double-join / penuh).

## RBAC (AD-01, auth)

Role: `super_admin | venue_owner | seller | user` (kolom `users.role`, default `user`).
Decorator `@Roles(...)` + `RolesGuard` (pakai setelah `JwtAuthGuard`).
Helper kepemilikan untuk BK/MP fase berikut: `assertOwnerOrAdmin(actor, ownerId)`
/ `isOwnerOrAdmin(actor, ownerId)` di `src/auth/ownership.ts`
(super_admin lolos semua; selain itu `actor.id` harus == `ownerId`).

### `GET /admin/ping`
Bukti guard: hanya `super_admin` → 200 `{ ok: true, role, userId }`.
Tanpa token → 401; role lain → 403.

Seed super_admin (idempotent): `admin@kawansport.id` / `Admin1234!` — lihat README root.

## CMS approval + edit-butuh-approve (AD-02, auth)

Tabel `change_requests` (`entity_type` venue/court/product, `entity_id`,
`payload` JSON ternormalisasi, `status` pending/approved/rejected,
`requested_by`, `reviewed_by`, `reason`, timestamps). Aturan: edit field
sensitif oleh owner/seller atas entity `approved` TIDAK langsung mengubah
entity — melainkan membuat CR `pending` (publik tetap data lama).
- Venue sensitif: `name`, `photos`.
- Court sensitif (bila venue induk `approved`): `name`, `pricePerHour`, `openHours`.
- Produk sensitif: `name`, `price`, `photos`, `description`.
- Edit non-sensitif atas approved langsung berlaku tanpa mengubah status;
  edit owner atas produk `rejected` me-reset ke `pending` (pengajuan ulang).
- Admin / entity non-approved → langsung ubah seperti sebelumnya.
- Audit: kolom `updated_by` di venue/court/product (diisi editor langsung
  maupun admin saat approve CR) + baris CR (`requested_by`, `reviewed_by`).

### `PATCH /venues/:id`, `PATCH /venues/:id/courts/:courtId`, `PATCH /products/:id`
- Langsung (200) bila admin / entity non-approved / non-sensitif.
- 202 `{ pendingReview: true, changeRequestId, entityType, entityId,
  status: "pending", message }` bila owner/seller menyentuh field sensitif
  atas entity approved. 403 lintas owner, 404 entity tak ada / tersembunyi.

### `GET /me/change-requests`
Daftar CR milik sendiri + filter `status?`, `entityType?`, `entityId?`,
`page?`, `limit?` → `{ data, meta }`. Tanpa token → 401.

### `GET /admin/change-requests`
Antrean moderasi (khusus super_admin), filter sama seperti di atas.

### `POST /admin/change-requests/:id/approve`
Terapkan payload ke entity (atomik dalam satu transaksi) + CR `approved` →
201. CR non-pending → 409; entity hilang → 404.

### `POST /admin/change-requests/:id/reject`
CR `rejected` + `reason` (entity tidak berubah) → 200. CR non-pending → 409.

### List read-only CMS (khusus super_admin, tanpa mutasi)
- `GET /admin/venues?status=` → `{ data: VenueItem[], meta: { total } }`
- `GET /admin/products?status=` → `{ data: ProductItem[], meta: { total } }`
- `GET /admin/sellers?status=` → `SellerItem[]`
- `GET /admin/users?role=&search=&page=&limit=` → `{ data, meta }`
- `GET /admin/bookings?status=` → `{ data, meta: { total } }`
- `GET /admin/orders?status=` → `{ data, meta: { total } }`
- Events: pakai `GET /events` (butuh JWT) + filter status client-side.
- Item venue/court/product kini memuat `updatedBy` (jejak audit).

## Slot availability + hold anti-race (BK-02, auth)

Slot digenerate dari `courts.open_hours` per tanggal, durasi default 60 menit
(keputusan PO). Tabel `slot_claims` (`court_id, date, start_minute/end_minute`,
`status` held/confirmed/released, `holder_id`, `expires_at`) + unique
`(court_id, date, start_minute)` mencegah ganda. `confirmed` (diisi modul
booking BK-03 nanti) terbaca sebagai `booked`. Hold kedaluwarsa 10 menit dan
otomatis terbaca `free` saat baca (`expires_at`); job bersih-bersih penuh di BK-03.

### `GET /courts/:id/availability?date=YYYY-MM-DD`
Response `{ courtId, date, slots: [{ date, start, end, startMinute, endMinute, status }] }`,
`status`: `free | held | booked`. Tanpa jam di hari itu → `slots: []`.
Tanggal kalender invalid → 400; court tak ada → 404.

### `POST /courts/:id/hold`
Body: `{ date, start: "HH:MM" | startMinute, durationMinutes? (default 60) }`.
Klaim transaksional anti-race (mutex + `SELECT FOR UPDATE` di Postgres +
unique-catch) → 201 `{ id, courtId, date, start, end, startMinute, endMinute,
status: "held", holderId, expiresAt, ... }`.
- 409 bila slot sudah `held` valid / `booked` (`confirmed`).
- 400 bila slot di luar `open_hours` hari itu.
- `released` / `held`-kedaluwarsa boleh diklaim ulang (baris sama dipakai ulang).

### `POST /holds/:id/release`
Lepas hold milik sendiri (idempotent → 200 `{ ok: true, id, status: "released" }`).
Venue owner / `super_admin` boleh melepas hold orang lain; user lain → 403.
`confirmed` tidak bisa di-release dari sini → 409. Hold tak ada → 404.

## Booking + Midtrans sandbox + webhook (BK-03, auth kecuali webhook)

Tabel `bookings` (`user_id, court_id, date, start_minute/end_minute`,
`status` pending/paid/expired/cancelled, `payment_ref` unique (= Midtrans
`order_id`), `amount` snapshot `court.price_per_hour` prorata durasi,
`snap_token/redirect_url`, `slot_claim_id`, `paid_at`).
Booking pending kedaluwarsa 30 menit setelah dibuat (keputusan PO) → `expired`
+ slot released (cron tiap 5 mnt + cek oportunistik saat baca/tulis booking).

Midtrans Snap (sandbox): `MidtransService.createTransaction`
(`order_id=payment_ref`, `gross_amount=amount`).
MODE STUB (terdokumentasi): bila `MIDTRANS_SERVER_KEY` kosong, tanpa network —
token `stub-snap-<order_id>` + URL stub; webhook diverifikasi dengan key kosong.
JANGAN hardcode key — selalu via env (`MIDTRANS_SERVER_KEY`,
`MIDTRANS_CLIENT_KEY`, `MIDTRANS_IS_PRODUCTION`, `MIDTRANS_SNAP_URL`).

### `POST /bookings`
Body: `{ courtId, date, start: "HH:MM" | startMinute, durationMinutes? (default 60) }`.
Slot langsung di-confirmed (anti-race, 409 bila booked/held orang lain) → 201
booking `pending` + `paymentRef/amount/snapToken/redirectUrl`.
- 400 bila slot di luar `open_hours` hari itu; 404 bila court tak ada.

### `GET /bookings/me`
Daftar booking milik sendiri, sort `createdAt` DESC → `{ data: BookingItem[] }`.

### `GET /bookings/:id`
Detail milik sendiri; milik orang lain → 403 (super_admin lolos).

### `POST /bookings/:id/cancel`
Hanya pemilik / super_admin, hanya `pending` → 200 `{ ok: true, id, status: "cancelled" }`
+ slot released. Non-pending → 409; milik orang lain → 403.

### `POST /payments/midtrans/notification`
PUBLIK (tanpa JWT). Verifikasi signature `SHA512(order_id+status_code+
gross_amount+server_key)` → 403 bila invalid. Routing kanal via prefix
`order_id`: `MP-` → order marketplace (MP-02, di bawah), selain itu →
booking BK-03. Idempotent: hanya `pending` yang bisa berubah (double-hit
aman); `payment_ref` unique.
- `settlement` / `capture` (+accept) → `paid` (`paid_at` diisi, slot tetap confirmed)
- `capture`+`challenge` → tetap pending; `capture`+`deny` → `cancelled`
- `cancel` / `deny` / `failure` → `cancelled` (+ slot released)
- `expire` → `expired` (+ slot released)

## Cart multiseller + checkout + orders per seller (MP-02, auth kecuali webhook)

Tabel `carts` (unique `user_id`, satu cart aktif per user) + `cart_items`
(unique `cart_id+product_id`, `qty`) + `orders` (`payment_ref` unique =
Midtrans `order_id` prefix `MP-`, `channel='marketplace'`, status
pending/paid/expired/cancelled, `total` snapshot) + `order_groups`
(`order_id+seller_id` unique, `subtotal`, status mengikuti order induk) +
`order_items` (snapshot `productName/price/qty/subtotal` per grup seller).

Checkout atomik: mutex in-process (wajib untuk sqljs-test, pola
`SlotsService` BK-02) + `SELECT FOR UPDATE` per produk urut id stabil di
Postgres → cek `approved` + stok → decrement → 1 order + N grup → cart
dikosongkan → transaksi Snap Midtrans (reuse `MidtransService` BK-03,
tanpa duplikasi verify). Gagal Snap → kompensasi (stok kembali + order
`cancelled`, pola yang sama dengan lepas-slot BK-03).

Webhook `MP-` (cabang di `BookingsService.handleNotification`, single
endpoint): settlement/capture(+accept) → order+grup `paid`; capture+challenge
→ tetap pending; cancel/deny/failure → `cancelled` + rollback stok;
expire → `expired` + rollback stok. Double-hit idempotent (guard status).

### `GET /cart`
Cart milik sendiri + `total` harga berjalan → `{ items: [{ productId, qty,
product{id,sellerId,sellerShopName,name,price,stock,status} }], total, count }`.
Belum pernah isi → cart kosong (bukan 404).

### `PUT /cart`
Satu bentuk untuk add/update/remove/clear:
- `{ productId, qty (>0) }` tambah/ubah; `{ productId, qty: 0 }` hapus baris.
- `{ clear: true }` kosongkan semua.
- Produk harus ada + `approved` (selain itu 404); tanpa `{productId,qty} /
  {clear:true}` → 400. Stok penuh dicek saat checkout (409 bila kurang).

### `POST /checkout`
Checkout cart milik sendiri → 201 order detail (`id, paymentRef MP-…,
channel, status pending, total, snapToken/redirectUrl stub-bila-tanpa-key,
groups[{ sellerId, sellerShopName, subtotal, status, items }]`) + stok
terdecrement + cart kosong. Cart kosong → 400; produk tak-approved/hilang
/ stok kurang → 409. 2 checkout paralel atas stok 1 → tepat 1 sukses.

### `GET /orders/me`
Daftar order milik sendiri (terbaru dulu, beserta grup+item) →
`{ data: OrderDetail[] }`.

### `GET /orders/:id`
Detail milik sendiri; milik orang lain → 403 (super_admin lolos); tak ada → 404.

## Voucher promo + Poin Kawan (ST-04, auth kecuali webhook)

Tabel `vouchers` (`code` unik uppercase, `type` percent|fixed, `value`,
`max_discount`, `min_transaction`, `quota` total, `per_user_limit`,
`used_count`, `valid_from/valid_to`, `applicable_to` booking|shop|all,
`active`) + `voucher_redemptions` (jejak redeem per user untuk
`perUserLimit`; dibuat dalam transaksi yang sama dengan booking/order,
dihapus hanya oleh kompensasi Snap-gagal).

Urutan akuntansi (booking maupun checkout): `subtotal → diskon voucher →
poin → total` (integer rupiah, min 0). Snapshot tersimpan di
booking/order: `subtotal, discount, voucherCode, pointsUsed`
(`amount`/`total` = TOTAL SETELAH diskon+poin — webhook wajib mengirim
`gross_amount` final tersebut, else 409).

- Diskon: percent = floor(subtotal×value/100) capped `maxDiscount`;
  fixed = min(value, subtotal).
- Poin: 1 poin = Rp1, capped sisa total setelah voucher; saldo kurang →
  400; saldo tidak pernah negatif (cek+mutasi satu transaksi).
- Earn: +50 Poin Kawan tiap review dibuat (`POST /ratings` dengan
  comment/foto; update tidak menambah). Saldo terlihat di `GET /me`
  (`loyaltyPoints`).
- Validasi voucher: tak dikenal → 400; nonaktif/kedaluwarsa/belum
  berlaku/scope salah/minimal tak terpenuhi → 400; kuota total atau
  per-user habis → 409. Tanpa mutasi bila gagal.
- Tidak ada hard delete voucher: nonaktifkan via deactivate (riwayat
  redeem + snapshot tetap utuh; `code` terkunci bila sudah dipakai).

### `POST /admin/vouchers` (super_admin)
Body: `{ code, type (percent 1..100 | fixed ≥1), value, maxDiscount?,
minTransaction? (default 0), quota?, perUserLimit?, validFrom?,
validTo? (ISO, from ≤ to), applicableTo? (default all), active?
(default true) }` → 201 item voucher. Duplikat code → 409.

### `GET /admin/vouchers` (super_admin)
`{ data: VoucherItem[], meta: { total } }`, terbaru dulu.

### `GET /admin/vouchers/:id` (super_admin)
Detail satu voucher. Tak ada → 404.

### `PATCH /admin/vouchers/:id` (super_admin)
Parsial; ganti `code` setelah dipakai → 409.

### `POST /admin/vouchers/:id/deactivate` (super_admin)
`active=false` (idempotent, 200). Redeem berikutnya → 400.

### `POST /bookings` (+ `voucherCode?`, `usePoints?`)
Field lama utuh; response/detail `BookingItem` tambah
`subtotal, discount, voucherCode, pointsUsed` + `serviceFee` (API-W03,
snapshot fee; `amount` sudah termasuk fee bila enabled).

### `POST /checkout` (body opsional `{ voucherCode?, usePoints? }`)
Tanpa body = checkout normal MP-02. Response/detail `OrderDetail` tambah
`subtotal, discount, voucherCode, pointsUsed`.
Gagal Snap → kompensasi: stok kembali + redeem dibatalkan + poin kembali
+ order `cancelled` (booking: slot dilepas + kompensasi sama).

## Pengaturan platform — service fee + komisi (API-W03, auth)

Tabel `platform_settings` (`key` unik, `value` string nullable,
`updatedAt`). Seed-on-boot di `SettingsService.onModuleInit` (satu-satunya
tempat seeding — tidak di `seed.ts`): bila tabel kosong, insert defaults.
Kunci dikenal (allowlist):

| key | tipe | default | aturan PUT |
|-----|------|---------|------------|
| `service_fee_enabled` | boolean-ish | `true` | `true/false`, `"true"/"false"`, `1/0` |
| `service_fee_amount` | integer rupiah | `2500` | integer `>= 0` |
| `commission_percent` | persen margin | `5` | number `0..100` |
| `commission_promo_percent` | persen promo (opsional) | `null` | number `0..100` atau `null`/`""` (clear) |
| `commission_promo_until` | akhir promo ISO (opsional) | `null` | ISO date atau `null`/`""` (clear) |

Efek ke booking flow: `serviceFee = enabled ? service_fee_amount : 0`
(dibaca langsung per booking, tanpa cache). Urutan akuntansi booking:
`amount = max(0, subtotal − discount − pointsUsed) + serviceFee`
(voucher + poin menutup subtotal dulu — fee TIDAK bisa dibayar poin).
`BookingItem` tambah `serviceFee` (snapshot, `0` bila fee off).
`amount` tetap TOTAL FINAL — Snap `gross_amount` + webhook
`assertAmountMatches` memakai nilai final tersebut (fee off → total tanpa
fee). Marketplace/checkout TIDAK kena fee. Komisi (`commission_*`) saat ini
hanya tersimpan (margin untuk kebutuhan mendatang; promo efektif bila
`commission_promo_percent` ter-set DAN `commission_promo_until` kosong /
masih di masa depan).

### `GET /admin/settings` (super_admin)
`{ data: [{ key, value (ter-parse: boolean | number | string | null),
raw (string | null), updatedAt }], meta: { total: 5 } }`.
Tanpa token → 401; role lain → 403.

### `PUT /admin/settings` (super_admin)
Body parsial Record key→value, mis.
`{ "service_fee_enabled": false }` atau
`{ "service_fee_amount": 3000, "commission_percent": 7 }` → 200 shape sama
dengan GET. Kunci asing → 400; tipe/rentang salah (fee negatif,
percent >100, tanggal invalid) → 400; body kosong → 400.

## Analitik owner per venue (API-W05, auth)

Guard dua lapis: `JwtAuthGuard + RolesGuard` (`venue_owner`,
`super_admin`) + cek DB `ownerId == user.id` di service (lintas
owner → 403, menutup catatan guard CMS). User biasa → 403.
Dipakai CMS owner (ganti form `venueId` manual via `/venues/mine`).
Agregasi di DB (`COUNT/SUM/GROUP BY`); join booking↔court memakai
`CAST(... AS TEXT)` agar join varchar-uuid aman di Postgres
(pelajaran FIX-02, pola `admin-stats`).

### `GET /venues/:id/stats?date=YYYY-MM-DD`
`date` default hari ini (UTC, string apa adanya seperti booking).
- 200: `{ venueId, occupancy: { date, totalSlots, bookedSlots, pct },
  reservations: { total, byStatus: { pending, paid, expired, cancelled } },
  revenue: { paidCount, gmv, commissionPercent, net },
  rating: { avg, count }, topCourts: [{ courtId, courtName, booked, gmv }] }`.
- `occupancy`: `totalSlots` = jumlah slot dari `open_hours` court
  **aktif** pada tanggal tsb; `bookedSlots` = booking `pending/paid`
  court venue ini pada tanggal tsb; `pct` = persen 2 desimal
  (0 bila tanpa slot).
- `reservations`: semua booking court venue ini (semua tanggal),
  `GROUP BY status`.
- `revenue`: booking `paid` → `gmv = SUM(amount)`; `commissionPercent`
  = komisi efektif `PlatformSetting` (API-W03, termasuk promo bila
  aktif); `net = round(gmv × (100 − commission) / 100)`.
- `rating`: `AVG(score)` (2 desimal, `null` bila belum ada) + `COUNT`
  dari `ratings` venue ini.
- `topCourts`: per court (`booked` = jumlah booking paid, `gmv` =
  total `amount` paid, court tanpa booking = 0), urut `gmv` DESC.
- 403 lintas owner; 400 tanggal kalender invalid; 404 venue tak ada.

### `GET /venues/mine?all=`
`{ data: [{ id, name, status, courtsCount }], meta: { total } }`,
urut `createdAt` DESC. Default milik sendiri; `super_admin` boleh
`?all=true` untuk semua venue (non-admin `all=true` → 403).
