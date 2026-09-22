import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UsersService } from '../users/users.service';
import type { UserRole } from '../users/user.entity';
import { ROLES_KEY } from './roles.decorator';

/**
 * Guard RBAC (AD-01). Dipasang setelah JwtAuthGuard:
 * `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('super_admin')`.
 *
 * - Tanpa metadata @Roles → lolos (hanya butuh JWT valid).
 * - Role diambil dari klaim token; bila token lama tanpa klaim role,
 *   fallback verifikasi ke DB agar tidak salah menolak admin.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const reqUser = req.user as
      | { id?: string; role?: UserRole }
      | undefined;
    if (!reqUser?.id) throw new UnauthorizedException('Missing access token');

    // SEC-01 Medium: untuk route yang memuat super_admin, role TIDAK
    // dipercaya dari klaim JWT — selalu baca ulang dari DB (menutup
    // eskalasi via token lama/curian). Keanggotaan tetap dicek terhadap
    // `required` agar route multi-role (mis. venue_owner+super_admin)
    // tidak berubah perilaku. Role lain tetap dari klaim (hindari overhead).
    if (required.includes('super_admin')) {
      const found = await this.users.findById(reqUser.id);
      const dbRole = (found?.role ?? 'user') as UserRole;
      req.user.role = dbRole;
      if (!required.includes(dbRole)) {
        throw new ForbiddenException('Forbidden: insufficient role');
      }
      return true;
    }

    let role = reqUser.role;
    if (!role) {
      const found = await this.users.findById(reqUser.id);
      role = (found?.role ?? 'user') as UserRole;
      req.user.role = role;
    }
    if (!required.includes(role)) {
      throw new ForbiddenException('Forbidden: insufficient role');
    }
    return true;
  }
}
