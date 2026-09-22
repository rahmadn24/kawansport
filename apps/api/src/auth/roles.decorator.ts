import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '../users/user.entity';

export const ROLES_KEY = 'roles';

/** Batasi endpoint ke role tertentu. Pakai bersama JwtAuthGuard + RolesGuard. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
