/**
 * Daftar origin CORS dari env (SEC-01 Medium — ganti `*`).
 * `CORS_ORIGIN` = comma-separated; default dev-friendly mencakup CMS
 * (:3001) + landing (:3002). Prod: set eksplisit domain CMS/app.
 */
export function getCorsOrigins(): string[] {
  const raw =
    process.env.CORS_ORIGIN ??
    'http://localhost:3001,http://localhost:3002';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
