import './env-preload';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync, mkdirSync } from 'fs';
import { AppModule } from './app.module';
import { getCorsOrigins } from './config/cors';
import { getUploadDir } from './users/upload.config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // SEC-01 Medium: origin dibatasi via CORS_ORIGIN (bukan `*`).
  app.enableCors({ origin: getCorsOrigins(), credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );
  // Serve lokal hasil upload (SM-03 avatar + ST-01 images):
  // GET /uploads/avatars/<file> dan /uploads/images/<file>.
  // nosniff (SEC-01 Medium) agar browser tidak menebak konten file upload.
  const uploadDir = getUploadDir();
  if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
  app.useStaticAssets(uploadDir, {
    prefix: '/uploads/',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setHeaders: (res: any) => res.setHeader('X-Content-Type-Options', 'nosniff'),
  });
  const port = Number(process.env.API_PORT ?? 3000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${port}`);
}
bootstrap();
