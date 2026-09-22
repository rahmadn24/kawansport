import { ForbiddenException } from '@nestjs/common';
import type { UserRole } from '../users/user.entity';

export interface ActorInput {
  id: string;
  role: UserRole;
}

/**
 * Helper kepemilikan untuk BK (booking) / MP (marketplace) fase berikut (AD-01).
 *
 * Aturan: super_admin boleh akses apa pun; selain itu `actor.id`
 * harus sama dengan `ownerId`, jika tidak → 403.
 *
 * Contoh pakai di service BK/MP:
 * ```ts
 * assertOwnerOrAdmin(req.user, venue.ownerId);
 * ```
 */
export function assertOwnerOrAdmin(
  actor: ActorInput,
  ownerId: string,
  message = 'Forbidden: not the owner',
): void {
  if (actor.role === 'super_admin') return;
  if (actor.id === ownerId) return;
  throw new ForbiddenException(message);
}

/** Versi boolean (tanpa throw) untuk filter list milik sendiri vs semua. */
export function isOwnerOrAdmin(actor: ActorInput, ownerId: string): boolean {
  return actor.role === 'super_admin' || actor.id === ownerId;
}
