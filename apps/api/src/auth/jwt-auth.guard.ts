import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { UserRole } from '../users/user.entity';

export interface AccessPayload {
  sub: string;
  email: string;
  role?: UserRole;
}

export interface RequestUser {
  id: string;
  email: string;
  role: UserRole;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const header: string = req.headers?.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing access token');
    }
    try {
      const payload = await this.jwt.verifyAsync<AccessPayload>(token);
      req.user = {
        id: payload.sub,
        email: payload.email,
        // Token lama (pra-AD-01) tidak punya klaim role → fallback `user`;
        // RolesGuard akan memverifikasi ulang ke DB bila dibutuhkan.
        role: payload.role ?? 'user',
      } as RequestUser;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }
}
