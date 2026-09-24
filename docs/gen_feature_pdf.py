"""Generator PDF Dokumen Fitur KawanSport (tersinkron API/CMS/Mobile/Landing).

Sumber kebenaran: apps/api/ENDPOINTS.md + hasil verifikasi 2026-09-24.
Jalankan: python3 docs/gen_feature_pdf.py
Output : docs/KawanSport-Fitur-Sync.pdf

Catatan: hanya memakai cell() + wrap manual karena multi_cell di
install fpdf2 mesin ini rusak untuk pemanggilan berurutan.
"""
import subprocess
from datetime import date
from fpdf import FPDF
from fpdf.enums import XPos, YPos

OUT = "docs/KawanSport-Fitur-Sync.pdf"
W = 190  # lebar teks A4 portrait margin 10


def git_hash() -> str:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"], text=True
        ).strip()
    except Exception:
        return "-"


class Doc(FPDF):
    def header(self):
        if self.page_no() == 1:
            return
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(100, 100, 100)
        self.cell(0, 6, "KawanSport - Dokumen Fitur Tersinkron",
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(2)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(100, 100, 100)
        self.cell(0, 10, f"Halaman {self.page_no()}/{{nb}}")

    def para(self, t, style="", size=10, h=5.5, color=(30, 30, 30)):
        self.set_font("Helvetica", style, size)
        self.set_text_color(*color)
        words = t.split(" ")
        line = ""
        for w_ in words:
            trial = (line + " " + w_).strip()
            if self.get_string_width(trial) <= W:
                line = trial
            else:
                if line:
                    self.cell(0, h, line, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
                line = w_
        if line:
            self.cell(0, h, line, new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    def h1(self, t):
        self.para(t, "B", 16, 9, (21, 128, 61))
        self.ln(2)

    def body(self, t):
        self.para(t)
        self.ln(1)

    def bullet(self, t):
        self.para("- " + t)
        self.ln(0.5)

    def feat(self, code, name, api, cms, mobile, landing, status):
        self.para(f"{code} - {name}", "B", 11, 6.5, (20, 20, 20))
        for label, val in (("API", api), ("CMS", cms),
                           ("Mobile", mobile), ("Landing", landing)):
            self.para(f"{label}: {val}")
        if status.startswith("SYNC"):
            self.para("Status: " + status, "B", 10, 6, (21, 128, 61))
        else:
            self.para("Status: " + status, "B", 10, 6, (200, 120, 0))
        self.ln(2)


pdf = Doc()
pdf.alias_nb_pages()
pdf.set_auto_page_break(True, 20)

# Sampul
pdf.add_page()
pdf.ln(30)
pdf.set_font("Helvetica", "B", 28)
pdf.set_text_color(21, 128, 61)
pdf.cell(0, 13, "KawanSport", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.set_font("Helvetica", "", 14)
pdf.set_text_color(60, 60, 60)
pdf.cell(0, 8, "Dokumen Fitur Tersinkron", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.cell(0, 8, "API  |  CMS  |  Mobile  |  Landing",
         new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.ln(6)
pdf.set_font("Helvetica", "", 11)
pdf.set_text_color(60, 60, 60)
pdf.cell(0, 7, f"Tanggal: {date.today().isoformat()}   |   Git: {git_hash()}",
         new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.cell(0, 7, "Sumber kebenaran: apps/api/ENDPOINTS.md",
         new_x=XPos.LMARGIN, new_y=YPos.NEXT)

# Ringkasan verifikasi
pdf.add_page()
pdf.h1("1. Ringkasan Verifikasi Sinkronisasi (2026-09-24)")
pdf.body(
    "API NestJS: tsc bersih + e2e 28 suite / 282 test hijau "
    "(FIREBASE_STUB=true jest --config ./test/jest-e2e.js --runInBand). "
    "Kegagalan sesekali pada full-run adalah flake beforeAll-timeout di bawah load; "
    "semua suite hijau saat rerun solo."
)
pdf.body("CMS Next.js: tsc bersih + next build 12/12 halaman sukses.")
pdf.body("Mobile React Native: tsc bersih + jest 11 suite / 103 test hijau.")
pdf.body("Landing Next.js: 100% statis (tanpa fetch API by design), next build 4/4 sukses.")
pdf.body(
    "Prinsip: hanya angka dari respons server yang ditampilkan. "
    "Yang belum ada endpoint-nya disembunyikan dengan TODO jujur, bukan angka palsu."
)

# Matriks fitur
pdf.add_page()
pdf.h1("2. Matriks Fitur per Aplikasi")

FEATS = [
    ("SM-01/02/03/06", "Auth, profil, cari partner",
     "POST /auth/*, GET/PATCH /me, POST /me/avatar, GET /users/search",
     "Login + guard role + redirect per role",
     "AuthContext + layar profil/partner (api/profile, partners)",
     "Statis (tidak fetch)", "SYNC - semua app"),
    ("SM-04/05", "Event + join/leave anti-race",
     "POST/GET /events, /events/:id/join|leave|participants",
     "Belum ada halaman event (di luar scope CMS)",
     "api/events + layar event (join/leave)",
     "Copy komunitas mabar (ilustrasi)", "SYNC - API+mobile"),
    ("ST-02", "Event berbayar (fee + Snap EV-)",
     "fee di event; join paid -> payment; webhook EV- settlement -> peserta",
     "Di luar scope CMS",
     "fee di create/detail; join 3-bentuk (gratis/pending/antre)",
     "Copy iuran open-play", "SYNC - API+mobile"),
    ("ST-03", "Waiting list event penuh",
     "409 {waitlisted, position}; /waitlist/me (GET/DELETE); /waitlist (host)",
     "Di luar scope CMS", "Tombol Masuk Antrean + klien waitlist",
     "-", "SYNC - API+mobile"),
    ("ST-01", "Media upload",
     "POST /uploads + GET /uploads/...; IsPhotoUrl",
     "URL dokumen legalitas via upload yang sama", "Avatar + foto (api/profile)",
     "-", "SYNC - API+mobile+CMS"),
    ("ST-04", "Voucher + Poin Kawan",
     "CRUD /admin/vouchers; voucherCode+usePoints di booking/checkout; loyaltyPoints di /me",
     "Tombol Buat Voucher (halaman voucher belum ada - TODO jujur)",
     "api/vouchers + section Voucher dan Poin di Cart/Checkout",
     "-", "SYNC - API+mobile (CMS: halaman voucher TODO)"),
    ("BK-02", "Slot availability + hold anti-race",
     "GET /courts/:id/availability; POST hold/release",
     "Grid court x jam real + status blocked",
     "api/venues + layar venue (isBookable)",
     "-", "SYNC - semua (display)"),
    ("BK-03/04", "Booking + Midtrans + event-booking",
     "POST /bookings; /bookings/me|:id|cancel; webhook; POST /events/:id/book",
     "-", "api/bookings + layar booking + kode check-in KS-...",
     "Copy booking instan", "SYNC - API+mobile"),
    ("MP-01/02", "Marketplace multiseller",
     "Sellers/products approval; cart; checkout; orders per seller",
     "Approvals seller/produk + lists", "api/shop + Cart/Checkout/Orders",
     "Copy Gear Locker", "SYNC - semua app"),
    ("AD-01/02", "RBAC + approval + edit-butuh-approve",
     "Roles; /admin/* lists; change-requests approve/reject; PATCH 202 bila sensitif",
     "Halaman approvals + lists + stats", "role di profil",
     "-", "SYNC - API+CMS"),
    ("API-W01", "Legalitas venue",
     "POST/DELETE /venues/:id/documents; verify admin; derived lengkap/parsial/kosong",
     "Badge legalitas + tambah/hapus dokumen (owner)",
     "Skip (owner-only CMS)", "-", "SYNC - API+CMS"),
    ("API-W02", "Dispute center",
     "POST /disputes; GET /disputes/me; admin list/investigate/resolve",
     "Tabel antrean open + anchor per baris", "api/disputes (create/listMine)",
     "-", "SYNC - semua app"),
    ("API-W03", "Platform settings",
     "GET/PUT /admin/settings (fee toggle, komisi persen)",
     "Fee dibaca dari server + label sumber (fallback jelas bila gagal)",
     "Snapshot serviceFee di booking/order", "B2B komisi flat 5%",
     "SYNC - semua app"),
    ("API-W04", "Activity feed",
     "GET /admin/activity (agregasi read-only 5 tipe)",
     "Tabel aktivitas real 10 terbaru", "-",
     "-", "SYNC - API+CMS"),
    ("API-W05", "Owner analytics",
     "GET /venues/:id/stats; GET /venues/mine",
     "/venues/mine ganti form manual; KPI dari stats server", "-",
     "-", "SYNC - API+CMS"),
    ("API-W06", "Walk-in + blokir slot",
     "POST /bookings/walk-in (paid langsung); blocks CRUD; status blocked",
     "Form walk-in + tambah/hapus block + sel blocked disabled",
     "Tipe blocked + isBookable (tanpa UI kasir)", "-", "SYNC - API+CMS+tipe mobile"),
    ("API-W07", "Check-in kode KS-XXXXXX",
     "GET /bookings/by-code/:code; POST /bookings/:id/check-in (sekali, 409 ulang)",
     "Stasiun check-in aktif + hasil lookup",
     "lookupBookingByCode + checkInBooking + tampil kode",
     "-", "SYNC - semua app"),
    ("API-W08", "Payout mitra",
     "GET /payouts/balance (saldo live); POST request; admin approve/reject/pay",
     "Saldo + request withdraw + riwayat (owner)", "api/payouts (balance/request/me)",
     "-", "SYNC - semua app"),
    ("PH3", "Push + chat + rating",
     "/notifications/register + FCM; chat REST+WS; ratings CRUD",
     "Rating venue dihitung dari respons real",
     "FCM native + deep-link + chat + rating",
     "-", "SYNC - API+mobile"),
]

for f in FEATS:
    pdf.feat(*f)

pdf.add_page()
pdf.h1("3. Kontrak Lintas-App (jangan dilanggar)")
pdf.bullet("Komisi platform: flat 5% dari GMV (dibaca via GET /admin/settings, bukan hardcode).")
pdf.bullet("Service fee: mengikuti service_fee_enabled/amount server; walk-in tanpa fee.")
pdf.bullet("Kode booking kasir: format KS-XXXXXX, unik; check-in sekali saja.")
pdf.bullet("Slot blocked bukan booked: statistik paid tidak tercemar maintenance.")
pdf.bullet("Pending payment event TIDAK makan slot sampai webhook settlement.")
pdf.bullet("Saldo payout dihitung live (tanpa tabel saldo yang bisa drift).")
pdf.bullet("Landing 100% statis: angka ilustrasi TODO-WEB, bukan data produksi.")

pdf.h1("4. Sisa TODO Jujur")
pdf.bullet("CMS: halaman voucher (tombol disabled jujur); rute detail dispute (anchor sementara).")
pdf.bullet("Mobile: UI kasir walk-in/check-in dan blokir slot (klien siap, layar belum).")
pdf.bullet("Backlog Trello To Do: EL-00..EL-05 (ELO), ST-05..ST-10, REL-01/02, GAP-01/02, OPS-01, UX-01/05.")

pdf.output(OUT)
print("OK -> " + OUT)
