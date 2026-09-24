import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from '../bookings/booking.entity';
import { EventParticipant } from '../events/event-participant.entity';
import { SportEvent } from '../events/event.entity';
import { Seller } from '../marketplace/seller.entity';
import { ShopOrder } from '../marketplace/shop-order.entity';
import { DeviceToken } from '../notifications/device-token.entity';
import { User } from '../users/user.entity';
import { Venue } from '../venues/venue.entity';
import { RefreshToken } from './refresh-token.entity';

/**
 * Hapus akun sendiri — `DELETE /me` (GAP-02).
 *
 * Aturan (didokumentasikan di ENDPOINTS.md seksi GAP-02):
 * - Data sesi milik user (refresh token + device token) SELALU dihapus
 *   (= logout semua sesi).
 * - Riwayat booking/order/event TIDAK dihapus diam-diam: bila user punya
 *   booking pending/paid, order pending/paid, event mendatang yang di-host
 *   atau diikuti, venue yang dimiliki, atau profil seller → 409 dengan alasan.
 * - Selain itu hard delete baris `users` (konsisten dengan pola repo yang
 *   tidak memakai soft-delete); sisa relasi non-aktif ikut aturan FK CASCADE.
 *
 * Lupa password SENGAJA tidak ada di sini: repo tidak punya infra email
 * (mailer), jadi tidak ada endpoint reset — lihat TODO di ENDPOINTS.md.
 */
@Injectable()
export class AccountService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
    @InjectRepository(DeviceToken)
    private readonly deviceTokens: Repository<DeviceToken>,
    @InjectRepository(Booking)
    private readonly bookings: Repository<Booking>,
    @InjectRepository(ShopOrder)
    private readonly orders: Repository<ShopOrder>,
    @InjectRepository(SportEvent)
    private readonly events: Repository<SportEvent>,
    @InjectRepository(EventParticipant)
    private readonly participants: Repository<EventParticipant>,
    @InjectRepository(Venue)
    private readonly venues: Repository<Venue>,
    @InjectRepository(Seller)
    private readonly sellers: Repository<Seller>,
  ) {}

  async deleteMe(userId: string): Promise<{ ok: true }> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const blockers: string[] = [];
    const now = Date.now();

    const activeBookings = await this.bookings.count({
      where: [
        { userId, status: 'pending' },
        { userId, status: 'paid' },
      ],
    });
    if (activeBookings > 0) {
      blockers.push(
        `${activeBookings} booking aktif (pending/paid) — batalkan dulu via POST /bookings/:id/cancel atau tunggu kedaluwarsa`,
      );
    }

    const activeOrders = await this.orders.count({
      where: [
        { userId, status: 'pending' },
        { userId, status: 'paid' },
      ],
    });
    if (activeOrders > 0) {
      blockers.push(
        `${activeOrders} order aktif (pending/paid) — riwayat belanja tidak dihapus diam-diam`,
      );
    }

    const hosted = await this.events.find({ where: { hostId: userId } });
    const upcomingHosted = hosted.filter(
      (e) => new Date(e.datetime).getTime() >= now,
    );
    if (upcomingHosted.length > 0) {
      blockers.push(
        `host dari ${upcomingHosted.length} event mendatang — hapus/alihkan dulu kepemilikan event`,
      );
    }

    const joined = await this.participants.find({ where: { userId } });
    if (joined.length > 0) {
      const eventIds = [...new Set(joined.map((p) => p.eventId))];
      const events = await this.events.findByIds(eventIds);
      const upcomingJoined = events.filter(
        (e) => new Date(e.datetime).getTime() >= now,
      );
      if (upcomingJoined.length > 0) {
        blockers.push(
          `peserta dari ${upcomingJoined.length} event mendatang — keluar dulu via POST /events/:id/leave`,
        );
      }
    }

    const ownedVenues = await this.venues.count({ where: { ownerId: userId } });
    if (ownedVenues > 0) {
      blockers.push(
        `pemilik ${ownedVenues} venue — hapus/alihkan dulu venue (menghapus venue ikut menghapus court + booking milik orang lain via cascade)`,
      );
    }

    const seller = await this.sellers.findOne({ where: { ownerId: userId } });
    if (seller) {
      blockers.push(
        'memiliki profil seller — tutup dulu toko (menghapus seller ikut menghapus produk + order grup via cascade)',
      );
    }

    if (blockers.length > 0) {
      throw new ConflictException(
        `Cannot delete account: ${blockers.join('; ')}`,
      );
    }

    // Logout semua sesi + cabut push device milik user.
    await this.refreshTokens.delete({ userId });
    await this.deviceTokens.delete({ userId });
    // Hard delete (repo tidak memakai soft-delete); relasi non-aktif lain
    // (partisipasi event lampau, dispute, rating, cart) ikut FK CASCADE.
    await this.users.delete(userId);
    return { ok: true };
  }
}
