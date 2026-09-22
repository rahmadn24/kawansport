# KawanSport API — production image untuk monorepo npm workspaces (INF-01).
#
# Build context = repo root (lihat docker-compose.yml service `api`:
# context: . + dockerfile: ./apps/api/Dockerfile), sehingga semua COPY
# memakai path relatif root (apps/api/...).
# Hanya deps apps/api yang di-install — apps/mobile (RN) TIDAK ikut
# agar image ramping. Mobile RN bare tetap jalan di host (emulator).

FROM node:20-alpine AS build
WORKDIR /app/apps/api
# Salin manifest dulu agar layer npm install ter-cache bila src belum berubah.
# (Tidak memakai `npm ci`: tidak ada lockfile per-app; lockfile ada di root
#  dan mencakup workspace mobile yang tidak dibutuhkan image ini.)
COPY apps/api/package.json ./
RUN npm install
COPY apps/api ./
RUN npm run build

FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app/apps/api
COPY apps/api/package.json ./
RUN npm install --omit=dev && npm cache clean --force
# Hasil compile Nest (termasuk dist/seed.js untuk `npm run seed:prod`).
COPY --from=build /app/apps/api/dist ./dist
# UPLOAD_DIR default ./uploads (relatif cwd) → /app/apps/api/uploads.
# Di compose di-mount sebagai named volume `uploadsdata` agar avatar SM-03
# persist antar restart container.
EXPOSE 3000
CMD ["node", "dist/main"]
