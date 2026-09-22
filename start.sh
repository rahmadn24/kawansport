#!/bin/bash
# KawanSport — one-command startup: infra + api + seed.
# Pakai: ./start.sh        (dari root repo)
# Lihat log: docker compose logs -f [api|cms|landing]
set -e
cd "$(dirname "$0")"

# 0. .env bila belum ada
if [ ! -f .env ]; then
  cp .env.example .env
  echo "[start] .env dibuat dari .env.example"
fi

# 1. Naikkan semua service (build bila perlu)
echo "[start] docker compose up --build -d ..."
docker compose up -d --build

# 2. Tunggu API healthy (maks ~3 menit)
echo "[start] menunggu API healthy di :3000 ..."
for i in $(seq 1 36); do
  if curl -sf http://localhost:3000/health >/dev/null 2>&1; then
    echo "[start] API healthy ✓"
    break
  fi
  if [ "$i" -eq 36 ]; then
    echo "[start] GAGAL: API tidak healthy. Cek: docker compose logs api db" >&2
    exit 1
  fi
  sleep 5
done

# 3. Seed akun (idempotent, aman diulang)
echo "[start] seeding database ..."
(cd apps/api && npm run seed)

echo ""
echo "==============================="
echo " KawanSport jalan ✓"
echo "  API     : http://localhost:3000/health"
echo "  CMS     : http://localhost:3001  (admin@kawansport.id / Admin1234!)"
echo "  Landing : http://localhost:3002"
echo " Matikan : docker compose down"
echo "==============================="
