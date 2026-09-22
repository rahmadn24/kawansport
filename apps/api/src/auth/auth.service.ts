import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { createHash, randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { RefreshToken } from './refresh-token.entity';

export function hashRefreshToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/** Parse '15m' | '1h' | '7d' | '30s' | detik-angka menjadi ms. */
export function parseTtlToMs(ttl: string, fallbackMs: number): number {
  if (/^\d+$/.test(ttl)) return Number(ttl) * 1000;
  const m = /^(\d+)(s|m|h|d)$/.exec(ttl.trim());
  if (!m) return fallbackMs;
  const n = Number(m[1]);
  const mult =
    m[2] === 's' ? 1000 : m[2] === 'm' ? 60_000 : m[2] === 'h' ? 3_600_000 : 86_400_000;
  return n * mult;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
  ) {}

  private get accessExpiresIn(): string {
    return process.env.JWT_ACCESS_TTL ?? '15m';
  }

  private get refreshExpiresIn(): string {
    return process.env.JWT_REFRESH_TTL ?? '7d';
  }

  private get refreshSecret(): string {
    return process.env.JWT_REFRESH_SECRET ?? `${process.env.JWT_SECRET ?? 'change-me-dev-only'}:refresh`;
  }

  async register(email: string, password: string, displayName?: string) {
    const existing = await this.users.findByEmail(email);
    if (existing) throw new ConflictException('Email already registered');
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.users.create({ email, passwordHash, displayName });
    const tokens = await this.issueTokenPair(user.id, user.email, user.role);
    return { user: this.users.toPublic(user), ...tokens };
  }

  async login(email: string, password: string) {
    const user = await this.users.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid email or password');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid email or password');
    await this.users.updateLastLogin(user.id);
    const tokens = await this.issueTokenPair(user.id, user.email, user.role);
    return { user: this.users.toPublic(user), ...tokens };
  }

  async refresh(rawRefreshToken: string) {
    let payload: { sub: string; type?: string };
    try {
      payload = await this.jwt.verifyAsync(rawRefreshToken, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (payload.type !== 'refresh' || !payload.sub) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const row = await this.refreshTokens.findOne({
      where: { tokenHash: hashRefreshToken(rawRefreshToken) },
    });
    if (!row || row.revoked || row.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (row.userId !== payload.sub) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    // Rotasi: cabut token lama lalu terbitkan pasangan baru.
    row.revoked = true;
    await this.refreshTokens.save(row);
    const user = await this.users.findById(payload.sub);
    if (!user) throw new UnauthorizedException('Invalid refresh token');
    await this.users.updateLastLogin(user.id);
    return this.issueTokenPair(user.id, user.email, user.role);
  }

  /** Idempotent: token tidak dikenal / sudah dicabut tetap 200 { ok: true }. */
  async logout(rawRefreshToken: string) {
    const row = await this.refreshTokens.findOne({
      where: { tokenHash: hashRefreshToken(rawRefreshToken) },
    });
    if (row && !row.revoked) {
      row.revoked = true;
      await this.refreshTokens.save(row);
    }
    return { ok: true };
  }

  private async issueTokenPair(userId: string, email: string, role?: string) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, email, role: role ?? 'user' },
      // TTL dari env (string) — cast agar cocok dengan tipe StringValue jsonwebtoken.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { expiresIn: this.accessExpiresIn as any },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: userId, type: 'refresh', jti: randomUUID() },
      {
        secret: this.refreshSecret,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expiresIn: this.refreshExpiresIn as any,
      },
    );
    const expiresAt = new Date(
      Date.now() + parseTtlToMs(this.refreshExpiresIn, 7 * 86_400_000),
    );
    await this.refreshTokens.save(
      this.refreshTokens.create({
        userId,
        tokenHash: hashRefreshToken(refreshToken),
        expiresAt,
        revoked: false,
      }),
    );
    return { accessToken, refreshToken };
  }
}
