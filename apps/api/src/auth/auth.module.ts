import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { MeController } from './me.controller';
import { RolesGuard } from './roles.guard';
import { RefreshToken } from './refresh-token.entity';

/**
 * Fail-closed (SEC-01 High): tanpa JWT_SECRET bootstrap langsung gagal —
 * tidak ada lagi fallback 'change-me-dev-only'. Dev/test mengisi secret
 * via env (lihat .env.example / setup E2E), bukan dari kode prod.
 */
function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is required (refusing insecure fallback)');
  }
  return secret;
}

@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([RefreshToken]),
    JwtModule.register({
      global: true,
      secret: requireJwtSecret(),
      // JWT_ACCESS_TTL bertipe string dari env; opsi sign menerima StringValue.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      signOptions: { expiresIn: (process.env.JWT_ACCESS_TTL ?? '15m') as any },
    }),
  ],
  controllers: [AuthController, MeController],
  providers: [AuthService, JwtAuthGuard, RolesGuard],
  exports: [AuthService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
