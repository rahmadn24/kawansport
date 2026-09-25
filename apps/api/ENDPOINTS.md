# KawanSport API — Daftar Endpoint (MVP SM-01..SM-07 + AD-01 + BK-01..BK-03 + API-W01..W08 + API-W02/W04 + GAP-01 + GAP-02)

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
| API-W06 | Walk-in owner + blokir slot maintenance | `POST /bookings/walk-in`, `POST/GET/DELETE /courts/:id/blocks[/:blockId]` (status availability baru: `blocked`) |
| API-W07 | Check-in via kode booking | `GET /bookings/by-code/:code`, `POST /bookings/:id/check-in` (kode `KS-XXXXXX`) |
| API-W04 | Activity feed admin (agregasi read-only) | `GET /admin/activity?limit=` (super_admin) |
| API-W08 | Payout & withdraw mitra (manual) | `POST/GET /payouts[/me|/balance]`, `POST /payouts/:id/{approve,reject,pay}` |
| API-W02 | Dispute center | `POST/GET /disputes[/me]`, `GET /disputes?status=`, `POST /disputes/:id/{investigate,resolve}` |
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
- Event gratis (`fee=0`): 201 detail event + `isJoined: true`.
- Event berbayar (`fee>0`, ST-02): 201 detail event + `isJoined: false` + `payment { id, amount (= snapshot fee), status: "pending", paymentRef (prefix EV-), snapToken, redirectUrl }`. Join ulang saat pending aktif → 201 idempotent (paymentRef sama).
- 409 bila sudah join. Event penuh (gratis maupun paid-penuh) → 409 `{ waitlisted: true, position }` + otomatis masuk antrean (ST-03). Transaksional anti-race.

### `POST /events/:id/leave`
- 200: detail event + `isJoined: false`.
- 404 bila bukan peserta.
- Setelah slot kosong, antrean terdepan otomatis dipromosi `invited` + notifikasi (ST-03).

## Event berbayar (ST-02, auth)

Kolom `fee` (int rupiah, IDR only, default 0 = gratis) di `SportEvent`. Diisi host saat `POST /events` (`fee? >= 0`), bisa diubah via `PATCH /events/:id` (ikut aturan host/super_admin; payment pending yang sudah terbit memakai snapshot lama). Host otomatis peserta #1 TANPA membayar. `fee` tampil di semua response event (`EventListItem.fee`).
- Pending payment TIDAK makan slot — `participantsCount`/`status` hanya berubah saat webhook paid.
- Webhook dipakai ulang: `POST /payments/midtrans/notification` routing prefix `EV-` (pola yang sama dengan `MP-`); verifikasi signature + `gross_amount` wajib = snapshot (beda → 409, tetap pending); idempotent (hanya `pending` yang berubah; double-hit aman).
- `settlement` / `capture(+accept)` → `paid` + user jadi participant. Event keburu penuh saat settlement → payment tetap `paid` tetapi user masuk antrean terdepan `invited` (tidak pernah over-capacity diam-diam).
- `capture+challenge` → tetap pending; `capture+deny` / `cancel` / `deny` / `failure` → `cancelled`; `expire` → `expired` (TTL oportunistik 30 mnt, sama dengan booking).
- Signature invalid → 403; paymentRef tak dikenal → 404.

## Waiting list (ST-03, auth)

Event penuh → `POST /events/:id/join` otomatis memasukkan user ke antrean (`position` = jumlah antrean + 1, 1-based, tidak di-reorder) + 409 body `{ message: "Event is full", waitlisted: true, position }`. Duplikat antrean → 409 `Already waitlisted`.

### `GET /events/:id/waitlist/me`
Posisi antreanku `{ userId, email, displayName, avatarUrl, position, status (waiting|invited), createdAt }`. 404 bila event tidak ada / tidak masuk antrean.

### `DELETE /events/:id/waitlist/me`
Keluar dari antrean → 200 `{ ok: true, eventId }`. 404 bila event tidak ada / tidak masuk antrean.

### `GET /events/:id/waitlist`
Hanya host / super_admin (selain itu 403). `{ data: WaitlistItem[] (urut position ASC), meta: { total } }`. 404 bila event tidak ada.

Promosi otomatis: saat ada slot kosong (`leave`), antrean `waiting` terdepan ditandai `invited` + notifikasi push best-effort (`type: event`). TODO(V2): undangan kedaluwarsa (V1 tidak kedaluwarsa — user invited tinggal join biasa).

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

### `POST /conversations/:id/messages` (GAP-02)
Kirim pesan via REST — detail di seksi GAP-02 (jalur persist sama dengan WS).

## Riwayat notifikasi + invite sparing (GAP-01, auth)

Tabel `notification_history` (`user_id` CASCADE, `type`, `title`, `body`,
`data` simple-json nullable, `read_at` nullable, `created_at`).
Ditulis otomatis setiap `POST /notifications/send` untuk SEMUA target
`userIds` (walau tanpa device) — kontrak `send` tidak berubah
(tetap `{ sent, failed }`).

### `GET /notifications/me`
Query `page?` (default 1), `limit?` (default 20, maks 100), sort
`createdAt` DESC → `{ data: NotificationItem[], meta: { page, limit, total } }`.
`NotificationItem`: `{ id, type, title, body, data|null, readAt|null, createdAt }`.
Tanpa token → 401.

### `POST /notifications/:id/read`
Tandai dibaca milik sendiri (idempotent — baca ulang tetap 200) → 200
`NotificationItem`. Lintas user → 404; tak ada → 404; tanpa token → 401.

Tabel `invites` (`from_user_id`/`to_user_id` CASCADE, `sport?` ≤60,
`message?` ≤500, `status` pending|accepted|declined|expired default
`pending`, `event_id?` opsional tanpa FK keras, timestamps).
`InviteItem`: `{ id, fromUserId, toUserId, sport|null, message|null,
status, eventId|null, createdAt, updatedAt }`.

### `POST /invites`
Body: `{ toUserId (UUID), sport?, message? (≤500), eventId? (UUID) }`
→ 201 `InviteItem` (`status: "pending"`).
- Diri sendiri → 400; `toUser` tak ada → 404; validasi gagal → 400.
- Duplikat pending sama (pengirim + penerima + eventId sama, null-safe) → 409.
- Tanpa token → 401.

### `GET /invites/me`
Default masuk (untukku, `toUserId == me`); `?dir=sent` = keluar
(`fromUserId == me`). Terbaru dulu → `{ data: InviteItem[] }`.
Tanpa token → 401.

### `POST /invites/:id/accept`
Hanya penerima (`toUser`); accept → `status: "accepted"` + buat/get
conversation keduanya (reuse `ChatService.getOrCreate`) → 200
`{ ...InviteItem, conversation: ConversationItem }`.
- Bukan penerima → 403; tak ada → 404; sudah terminal (accept/decline
  ulang) → 409.

### `POST /invites/:id/decline`
Hanya penerima → `status: "declined"` → 200 `InviteItem`.
Aturan 403/404/409 sama dengan accept.

### WebSocket (Socket.io, path default `/socket.io`)
Auth: JWT access token via `handshake.auth.token` (atau `handshake.query.token`). Tanpa token valid koneksi ditolak.
- client → `join { conversationId }` → server `{ ok, conversationId }` (verifikasi membership dulu).
- client → `message:send { conversationId, body (1..2000 char) }` → persist + broadcast `message:new` (isi `MessageItem`) ke room conversation + `conversation:update { conversationId, lastMessage, unreadCount }` ke personal room kedua user.
- server → `message:new`, server → `conversation:update`.

## Rating & review kaya (SM-08 + ST-01 + ST-04 + ST-06)

Satu user boleh rating satu venue/court sekali (unique `userId+venueId+courtId`,
duplikat → 409). `score` integer 1..5. Review (1:1 dengan rating) dibuat bila
ada isi: `comment`, `photos` (ST-01, maks 3, path `/uploads/...` atau `https`),
`aspects`/`tags`/`isAnonymous` (ST-06). Update tidak menambah Poin Kawan;
review yang dikosongkan total (tanpa isi + tidak anonim) dihapus.
`RatingItem.user` tidak pernah memuat email.

ST-06 — field review baru:
- `aspects`: `{ lapangan?, cahaya?, bersih?, staf? }`, masing-masing integer
  1..5, semua opsional (parsial OK). Nilai di luar 1..5 → 400. Kunci asing
  di-strip oleh ValidationPipe `whitelist` global (bukan 400 — konvensi API).
  PUT mengganti total (bukan merge); `aspects: null` menghapus semua aspek.
- `tags`: string[] maks 5 × 30 char. Server menormalisasi: trim + lowercase,
  buang kosong, dedupe (jaga urutan). Lebih dari 5 / ada yang >30 char → 400.
  PUT mengganti total.
- `isAnonymous` (boolean, default `false`): bila `true`, respons dengan viewer
  selain owner review / `super_admin` menyamarkan
  `user = { id, displayName: "Anonim", avatarUrl: null }`.
  Owner review + admin selalu lihat asli. `id`/`userId` tetap asli
  (kunci stabil, bukan identitas tampilan).
- Endpoint publik (`GET` list/detail) menerima Bearer OPSIONAL: tanpa token /
  token invalid request tetap 200 (tersamar); dengan token owner/admin
  response menampilkan identitas asli.

### `POST /ratings` (auth)
Body: `{ venueId, courtId?, score (1..5), comment? (≤1000), photos? (≤3),
aspects? ({lapangan?,cahaya?,bersih?,staf?} 1..5), tags? (≤5 × 30 char),
isAnonymous? }` → 201 `RatingItem`.
- 401 tanpa token; 404 venue/court tak ada (court harus milik venue tsb, else 400);
  409 bila sudah rating venue/court ini.
- Review dengan isi apa pun (termasuk hanya aspek/tag/anonim) memberi
  +50 Poin Kawan sekali (ST-04, terlihat di `GET /me` → `loyaltyPoints`).

### `GET /ratings/venues/:venueId/ratings` (publik, Bearer opsional)
Query: `page?` (default 1), `limit?` (default 20, maks 50),
`sortBy?` (`latest` default | `highest` | `lowest`) →
`{ data: RatingItem[], meta: { page, limit, total } }`. 404 venue tak ada.

### `GET /ratings/courts/:courtId/ratings` (publik, Bearer opsional)
Sama seperti list venue tetapi untuk court spesifik. 404 court tak ada.

### `GET /ratings/:id` (publik, Bearer opsional)
Detail satu rating + review (`RatingItem`). Tak ada → 404.

`RatingItem`: `{ id, userId, user{id,displayName,avatarUrl}, venueId,
courtId|null, score, review{id,comment,photos,aspects,tags,isAnonymous,
createdAt,updatedAt}|null, createdAt, updatedAt }`.

### `PUT /ratings/:id` (auth, owner / super_admin)
Body parsial: `{ score?, comment?, photos?, aspects?|null, tags?, isAnonymous? }`
→ 200 `RatingItem`. Lintas owner → 403; tak ada → 404.

### `DELETE /ratings/:id` (auth, owner / super_admin)
Hard delete (review ikut cascade) → 204. Lintas owner → 403; tak ada → 404.

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
`status`: `free | held | booked | blocked` (`blocked` = ditutup owner via
API-W06, lihat seksi Walk-in). Tanpa jam di hari itu → `slots: []`.
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

## Pesanan & produk seller (toko)

Dashboard toko CMS (pengganti list publik yang hanya memuat `approved`).
Kedua endpoint butuh JWT + profil seller milik sendiri — tanpa profil
→ 404 `{ message: "Belum punya toko ..." }` (jujur, bukan array kosong)
agar client bisa mengarahkan onboarding. Status profil apa pun boleh
(pending/approved/rejected); yang dicek keberadaan profil, bukan approval.

### `GET /products/mine` (auth)
Semua produk milik toko sendiri — SEMUA status
(pending/approved/rejected), terbaru dulu.
Query: `page?` (default 1), `limit?` (default 20, maks 50).
Response `{ data: ProductItem[], meta: { page, limit, total } }`
(`ProductItem` sama dengan list publik: `id, seller{id,shopName,ownerId},
category, name, description, price, stock, photos, status,
rejectionReason, updatedBy, createdAt, updatedAt`).
- Tanpa token → 401; tanpa profil seller → 404.
- Produk seller lain TIDAK bocor (filter `sellerId` milik sendiri).

### `GET /orders/seller` (auth)
Daftar grup order milik toko sendiri (satu baris per grup seller +
order induknya), terbaru dulu.
Query: `page?` (default 1), `limit?` (default 20, maks 50).
Response `{ data: SellerOrderGroup[], meta: { page, limit, total } }`.
`SellerOrderGroup`: `{ groupId, orderId, paymentRef, status (mengikuti
order induk), subtotal, sellerShopName, items[] (snapshot
`productId/productName/qty/price/subtotal`), buyerDisplayName (SAJA —
email/telepon buyer TIDAK diekspos), paidAt, createdAt }`.
- Tanpa token → 401; tanpa profil seller → 404.
- Seller tanpa order → `{ data: [], meta: { total: 0 } }`.

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

## Dokumen legalitas venue (API-W01, auth)

Tabel `venue_documents` (`venue_id` CASCADE, `type`
siup|nib|imb|sertifikat_tanah|mou_lainnya, `url`, `status`
pending|verified|rejected default `pending`, `note`, timestamps).
Langsung tanpa change request (bukan field sensitif AD-02).
URL mengikuti aturan ST-01: hanya path `/uploads/...` atau URL `https`
(`http`, skema lain, `..` → 400).

`GET /venues/:id` menyertakan `documents: [{ id, venueId, type, url,
status, note, createdAt, updatedAt }]` + status turunan
`legalitas: 'lengkap'|'parsial'|'kosong'` HANYA untuk owner venue /
super_admin; publik (termasuk `GET /venues` list) tidak memuat kedua
field tersebut. Definisi: `lengkap` bila >= 2 dokumen `verified`,
`parsial` bila >= 1 dokumen apa pun statusnya, selain itu `kosong`.

### `POST /venues/:id/documents` (owner venue / super_admin)
Body: `{ type (salah satu dari 5 di atas), url }` → 201 item dokumen
(status `pending`). Lintas owner → 403; venue tak ada → 404;
type/URL invalid → 400. Tanpa token → 401; role lain → 403.

### `DELETE /venues/:id/documents/:docId` (owner venue / super_admin)
→ 204 (tanpa body). Lintas owner → 403; dokumen tak ada / milik venue
lain → 404.

### `POST /venues/:id/documents/:docId/verify` (khusus super_admin)
Body: `{ status: verified|rejected, note? (≤1000) }` → 200 item dokumen.
Status selain itu (termasuk `pending`) → 400; non-admin → 403;
dokumen tak ada / milik venue lain → 404.

## Walk-in + blokir slot (API-W06, auth)

Tabel `bookings` tambah `channel` (`app` default | `walkin`), `buyer_name`
(wajib untuk walk-in), `created_by` (audit owner pencatat). Tabel baru
`slot_blocks` (`court_id` CASCADE, `date`, `start_minute/end_minute`,
`reason?`, `created_by`, unique `(court_id, date, start_minute)`).
Status availability baru `blocked` — SENGAJA beda dari `booked` agar
statistik okupansi API-W05 (dihitung dari booking) tetap jujur.
Prioritas di availability: klaim aktif (held-valid/confirmed) MENANG atas
blokir — slot terbooking tetap terbaca `booked`; blokir hanya menutup slot
bebas dalam rentangnya + menolak klaim baru (hold/confirm → 409, sama
seperti booked). Expire logic booking mengabaikan blokir (blokir dibuka
manual via DELETE, tidak kedaluwarsa).

### `POST /bookings/walk-in` (owner venue court tsb / super_admin)
Body: `{ courtId, date, start: "HH:MM" | startMinute, durationMinutes?
(default 60), buyerName (wajib, ≤120), amount? (default harga court prorata
durasi, TANPA service fee) }` → 201 booking `paid` langsung (tanpa Midtrans:
`snapToken/redirectUrl` null, `paymentRef` auto `WALKIN-...`, `paidAt` diisi,
`channel: "walkin"`, `userId` = owner pencatat). Slot claim flow SAMA
(anti double + tolak blocked → 409). Lintas owner / user biasa → 403;
court tak ada → 404; di luar open hours → 400.

### `POST /courts/:id/blocks` (owner venue / super_admin)
Body: `{ date, start: "HH:MM" | startMinute, durationMinutes? (default 60,
boleh >60 untuk multi-slot), reason? (≤255) }` → 201 `BlockItem`
(`id, courtId, date, start, end, startMinute, endMinute, reason,
createdBy`). Lintas owner → 403; duplikat exact → 409; tidak overlap
open hours → 400.

### `GET /courts/:id/blocks?date=` (owner venue / super_admin)
`{ data: BlockItem[], meta: { total } }`, urut tanggal + jam ASC.
Lintas owner → 403.

### `DELETE /courts/:id/blocks/:blockId` (owner venue / super_admin)
→ 200 `{ ok: true, id }`. Blokir tak ada / milik court lain → 404;
lintas owner → 403. Slot kembali `free` (kecuali ada klaim aktif).

## Check-in via kode (API-W07, auth)

Kolom `bookings.code` unik (`KS-XXXXXX`, alfabet tanpa 0/O/1/I ambigu) +
`checked_in_at`. Kode dibuat saat create SEMUA channel (app, walk-in,
event); baris lama (pra-W07, `code` null) di-backfill oportunistik di
`expireDueBookings` (maks 100/call). `BookingItem` tambah
`channel, buyerName, createdBy, code, checkedInAt`.

### `GET /bookings/by-code/:code` (owner venue booking tsb / super_admin)
Lookup untuk kasir (kode case-insensitive). Lintas owner / kode tak
dikenal → 404 (tanpa membocorkan keberadaan booking).

### `POST /bookings/:id/check-in` (owner venue booking tsb / super_admin)
Check-in sekali saja → 200 `BookingItem` (`checkedInAt` terisi). Ulang →
409; non-`paid` (pending/cancelled/expired) → 409; lintas owner / tak
ada → 404.

## Activity feed admin (API-W04, auth khusus super_admin)

Agregasi read-only lintas tabel, TANPA tabel baru. Tiap sumber di-query
`ORDER BY waktu DESC LIMIT N` lalu digabung + merge-sort di memori
(N kecil: `limit` maks 100 — sederhana + cepat, tanpa UNION SQL kompleks).
Modul payout belum ada → di-skip (tambah satu sumber + satu tipe bila lahir).

### `GET /admin/activity?limit=` (super_admin)
- `limit?` default 20, maks 100 (>100 → 400). Tanpa token → 401; role lain → 403.
- 200: `{ data: ActivityItem[] }`, urut waktu DESC, maks `limit` item.
- `ActivityItem`: `{ type, at, title, detail?, refType?, refId? }`.
- `type`: `booking_paid` ("Booking lunas", `at` = `paidAt`),
  `booking_checkin` ("Check-in booking", `at` = `checkedInAt`),
  `order_paid` ("Order lunas", `at` = `paidAt`),
  `user_joined` ("User baru", `at` = `createdAt`),
  `voucher_redeem` ("Voucher dipakai", `at` = `createdAt` redeem).
- `refType/refId`: `booking | order | user` + id baris sumber
  (redeem menunjuk booking/order hasil redeem).

## Dispute center (API-W02, auth)

Tabel `disputes` (`reporter_id` CASCADE, `target_type`
booking|order|user|venue, `target_id` (validasi longgar: non-empty, tanpa
FK keras karena target lintas tabel), `category`
no_show|smurfing|refund|other, `description` ≤2000, `status`
open|investigating|resolved|rejected default `open`, `resolution`,
`resolved_by`, timestamps).
TODO: resolve dengan refund otomatis di luar scope — bila dibutuhkan,
tambah aksi refund terpisah (reversal Midtrans / poin) dengan auditnya
sendiri, jangan implisit di resolve.

### `POST /disputes` (user login)
Body: `{ targetType, targetId (non-empty), category, description (≤2000) }`
→ 201 item dispute (`status: "open"`, `reporterId` = user JWT).
Tanpa token → 401; field invalid → 400.

### `GET /disputes/me` (user login)
Daftar laporan milik sendiri, terbaru dulu → `{ data: DisputeItem[] }`.
Reporter hanya lihat miliknya (endpoint admin butuh super_admin).

### `GET /disputes?status=` (khusus super_admin)
Antrean moderasi, filter `status?`
(open|investigating|resolved|rejected) → `{ data, meta: { total } }`.
Tanpa token → 401; role lain → 403.

### `POST /disputes/:id/investigate` (khusus super_admin)
`open` → `investigating` → 200 item. Status lain → 409; tak ada → 404.

### `POST /disputes/:id/resolve` (khusus super_admin)
Body: `{ status: resolved|rejected, resolution? (≤2000) }` → 200 item
(`resolvedBy` = admin).
- `resolved` WAJIB `resolution` non-kosong (else 400); `rejected` opsional.
- Hanya dari `open`/`investigating` (sudah terminal → 409).
- Status selain resolved/rejected → 400; tak ada → 404.

## Payout & withdraw mitra (API-W08, auth)

Payout = CATAT-DAN-APPROVE manual transfer, TANPA integrasi Midtrans
disbursement API (keputusan PO FINAL — modul Midtrans hanya punya Snap +
verify webhook, tidak ada disbursement/Iris; grep `disbursement|iris|
payout` di `src/` hanya menemukan komentar placeholder activity feed).

Tabel `payouts` (`payee_type` venue|seller, `payee_id` = id venue/seller,
`amount` integer > 0, `bank_name/account_number/account_name` opsional,
`status` requested|approved|rejected default `requested` (`paid` = sudah
ditransfer manual + `reference`), `reference?` bukti transfer teks,
`reason?` alasan reject, `requested_by`, `handled_by?`, timestamps).
Tidak ada tabel saldo terpisah (anti-drift): saldo selalu dihitung live
dari data real — reuse rumus net API-W05
(`net = round(gross × (100 − commission) / 100)` dengan komisi efektif
API-W03 termasuk promo bila aktif).

- Venue: `gross` = SUM(`amount`) booking `paid` atas court venue tsb
  (termasuk walk-in; `amount` sudah final termasuk service fee — konsisten
  dengan revenue API-W05).
- Seller: `gross` = SUM(`subtotal`) `order_groups` `paid` seller tsb.
- `reserved` = SUM(`amount`) payout `approved`+`paid` payee tsb
  (`requested`/`rejected` TIDAK mengunci saldo).
- `available` = `net − reserved` (batas withdraw).

### `GET /payouts/balance` (venue_owner / seller / super_admin)
- Dengan `?payeeType=venue|seller&payeeId=<uuid>` (wajib berpasangan,
  else 400): satu payee milik sendiri → 200
  `{ payeeType, payeeId, gross, commissionPercent, net, reserved, available }`.
  Lintas owner → 403; payee tak ada → 404.
- Tanpa query: agregat semua payee milik sendiri
  `{ payeeType: null, payeeId: null, gross, commissionPercent, net,
  reserved, available, breakdown: BalanceItem[] }`.
  Super_admin tanpa query → 400 (harus tunjuk payee).
- Tanpa token → 401; role `user` → 403.

### `POST /payouts` (venue_owner / seller / super_admin)
Body: `{ payeeType, payeeId, amount (integer ≥ 1), bankName?,
accountNumber?, accountName? }` → 201 payout `requested`
(`requestedBy` = user JWT).
- `amount` ≤ `available` (else 409); payee tak ada → 404; lintas
  owner → 403; validasi DTO gagal → 400.

### `GET /payouts/me` (venue_owner / seller / super_admin)
Riwayat milik sendiri (yang diminta actor ATAU yang payee-nya dimiliki
actor — agar request admin untuk payee-nya tetap terlihat), terbaru dulu
→ `{ data: PayoutItem[] }`.
`PayoutItem`: `id, payeeType, payeeId, amount, bankName, accountNumber,
accountName, status, reference, reason, requestedBy, handledBy,
createdAt, updatedAt`.

### `GET /payouts?status=` (khusus super_admin)
Antrean payout, filter `status?`
(requested|approved|rejected|paid) → `{ data, meta: { total } }`.
Tanpa token → 401; role lain → 403.

### `POST /payouts/:id/approve` (khusus super_admin)
Body: `{ reference? (≤255) }`. `requested` → `approved` (`handledBy` =
admin) → 200 item. Status lain → 409; tak ada → 404.

### `POST /payouts/:id/reject` (khusus super_admin)
Body: `{ reason? (≤1000) }`. `requested` → `rejected` → 200 item
(`rejected` tidak mengunci saldo). Status lain → 409; tak ada → 404.

### `POST /payouts/:id/pay` (khusus super_admin)
Body: `{ reference (wajib non-empty, ≤255) }`. `approved` → `paid`
(menandai transfer manual sudah dilakukan) → 200 item. Reference kosong
→ 400; status selain `approved` → 409; tak ada → 404.

## Akun + kirim pesan REST (GAP-02, auth)

### `POST /conversations/:id/messages`
Kirim pesan via REST — jalur persist SAMA dengan WS (`ChatService.send`):
verifikasi anggota dulu (bukan anggota → 403, tak ada → 404), trim +
batas 1..2000 char, `lastMessageAt` ter-update; unread dihitung live.
Body: `{ body (string, 1..2000 char setelah trim) }` (DTO `SendMessageDto`).
- 201: `MessageItem` (`id, conversationId, senderId, body, createdAt, readAt`).
- 400: body kosong / whitespace-only / >2000 char / hilang / bukan string.
- Broadcast WS realtime (`message:new`, `conversation:update`) tetap hanya
  lewat gateway — client REST poll `GET /conversations/:id/messages`.
- TODO: rate-limit kirim pesan (saat ini hanya validasi; mis. N pesan/menit
  per user bila abuse chat muncul).

### `DELETE /me`
Hapus akun sendiri → 200 `{ ok: true }`. Tanpa token → 401.
Selalu menghapus: semua refresh token (logout SEMUA sesi — login/refresh
berikutnya → 401) + semua device token push milik user.
Hard delete baris `users` (repo tidak memakai soft-delete); relasi non-aktif
lain (partisipasi event lampau, dispute, rating, cart) ikut FK CASCADE.

Riwayat TIDAK dihapus diam-diam — kondisi berikut menolak dengan 409
`Cannot delete account: <alasan; ...>` (akun tetap utuh, masih bisa login):
- booking `pending`/`paid` milik user (batalkan dulu via
  `POST /bookings/:id/cancel` atau tunggu kedaluwarsa; `paid` tidak bisa
  dibatalkan — akun terkunci selama riwayat lunas ada);
- order marketplace `pending`/`paid` milik user;
- user host dari event mendatang (`datetime >= now`);
- user peserta dari event mendatang (keluar dulu via `POST /events/:id/leave`);
- user pemilik ≥1 venue (menghapus venue ikut menghapus court + booking
  milik orang lain via cascade — alihkan/hapus venue dulu);
- user memiliki profil seller (tutup toko dulu — cascade ke produk/order grup).

### Lupa password
TODO (jujur): TIDAK ADA endpoint forgot/reset-password — repo tidak punya
infra email (tidak ada mailer/SMTP; grep `mailer|nodemailer|smtp` di `src/`
hanya menemukan komentar TODO ini). Jangan mock kirim email. Bila dibutuhkan:
tambah provider email + tabel token reset (single-use, TTL pendek, hash di DB
seperti refresh token) + `POST /auth/forgot-password` (selalu 200 tanpa
membocorkan keberadaan email) + `POST /auth/reset-password` + e2e.
