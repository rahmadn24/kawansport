import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { ActorInput } from '../auth/ownership';
import { assertOwnerOrAdmin } from '../auth/ownership';
import { Booking, BookingStatus } from '../bookings/booking.entity';
import { Rating } from '../ratings/rating.entity';
import { SettingsService } from '../settings/settings.service';
import { Court } from './court.entity';
import { Venue } from './venue.entity';
import {
  assertValidDate,
  generateSlotsForDate,
} from './slots.service';

export interface VenueOccupancy {
  date: string;
  totalSlots: number;
  bookedSlots: number;
  pct: number;
}

export interface VenueReservations {
  total: number;
  byStatus: Record<BookingStatus, number>;
}

export interface VenueRevenue {
  paidCount: number;
  gmv: number;
  /** Margin platform efektif (%) dari PlatformSetting (API-W03). */
  commissionPercent: number;
  /** gmv − komisi (dibulatkan ke rupiah). */
  net: number;
}

export interface VenueRatingSummary {
  avg: number | null;
  count: number;
}

export interface TopCourtStat {
  courtId: string;
  courtName: string;
  booked: number;
  gmv: number;
}

export interface VenueStats {
  venueId: string;
  occupancy: VenueOccupancy;
  reservations: VenueReservations;
  revenue: VenueRevenue;
  rating: VenueRatingSummary;
  topCourts: TopCourtStat[];
}

export interface MineVenueItem {
  id: string;
  name: string;
  status: Venue['status'];
  courtsCount: number;
}

/** Status booking yang menahan slot pada tanggal occupancy. */
const ACTIVE_BOOKING_STATUSES: BookingStatus[] = ['pending', 'paid'];

/**
 * Analitik per venue untuk owner (API-W05).
 * Guard dua lapis: controller (`JwtAuthGuard + RolesGuard` venue_owner /
 * super_admin) + service (`assertOwnerOrAdmin` lawan `ownerId` di DB —
 * 403 lintas owner, menutup catatan guard CMS).
 */
@Injectable()
export class VenueStatsService {
  constructor(
    @InjectRepository(Venue)
    private readonly venues: Repository<Venue>,
    @InjectRepository(Court)
    private readonly courts: Repository<Court>,
    @InjectRepository(Booking)
    private readonly bookings: Repository<Booking>,
    @InjectRepository(Rating)
    private readonly ratings: Repository<Rating>,
    private readonly settings: SettingsService,
  ) {}

  /**
   * GET /venues/:id/stats?date= — agregasi DB (COUNT/SUM/GROUP BY).
   * Join booking↔court memakai `CAST(... AS TEXT)` agar join
   * varchar-uuid aman di Postgres (pelajaran FIX-02, pola admin-stats).
   */
  async getStats(
    venueId: string,
    actor: ActorInput,
    date?: string,
  ): Promise<VenueStats> {
    const venue = await this.venues.findOne({ where: { id: venueId } });
    if (!venue) throw new NotFoundException('Venue not found');
    assertOwnerOrAdmin(actor, venue.ownerId);

    const day = date ?? new Date().toISOString().slice(0, 10);
    assertValidDate(day);

    const venueCourts = await this.courts.find({
      where: { venueId },
      order: { createdAt: 'ASC' },
    });
    const courtIds = venueCourts.map((c) => c.id);

    // --- Occupancy: kapasitas dari openHours court aktif, terisi dari
    // booking aktif (pending/paid) pada tanggal tsb. ---
    const activeCourts = venueCourts.filter((c) => c.status === 'active');
    const totalSlots = activeCourts.reduce(
      (sum, c) => sum + generateSlotsForDate(c.openHours, day).length,
      0,
    );
    let bookedSlots = 0;
    if (courtIds.length > 0) {
      bookedSlots = await this.bookings
        .createQueryBuilder('b')
        .where('b.date = :day', { day })
        .andWhere('b.status IN (:...statuses)', {
          statuses: ACTIVE_BOOKING_STATUSES,
        })
        .andWhere('b.courtId IN (:...courtIds)', { courtIds })
        .getCount();
    }
    const pct =
      totalSlots > 0 ? Math.round((bookedSlots / totalSlots) * 10000) / 100 : 0;

    // --- Reservations: semua booking court venue ini, GROUP BY status. ---
    const byStatus: Record<BookingStatus, number> = {
      pending: 0,
      paid: 0,
      expired: 0,
      cancelled: 0,
    };
    let reservationsTotal = 0;
    if (courtIds.length > 0) {
      const rows = await this.bookings
        .createQueryBuilder('b')
        .select('b.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .where('b.courtId IN (:...courtIds)', { courtIds })
        .groupBy('b.status')
        .getRawMany<{ status: BookingStatus; count: string }>();
      for (const r of rows) {
        if (r.status in byStatus) {
          byStatus[r.status] = Number(r.count);
          reservationsTotal += Number(r.count);
        }
      }
    }

    // --- Revenue: booking paid → gmv + net setelah komisi efektif
    // PlatformSetting (API-W03, termasuk promo komisi bila aktif). ---
    let paidCount = 0;
    let gmv = 0;
    if (courtIds.length > 0) {
      const row = await this.bookings
        .createQueryBuilder('b')
        .select('COUNT(*)', 'count')
        .addSelect('COALESCE(SUM(b.amount), 0)', 'sum')
        .where('b.courtId IN (:...courtIds)', { courtIds })
        .andWhere('b.status = :status', { status: 'paid' as BookingStatus })
        .getRawOne<{ count: string; sum: string }>();
      paidCount = Number(row?.count ?? 0);
      gmv = Number(row?.sum ?? 0);
    }
    const commission = await this.settings.getEffectiveCommissionPercent();
    const net = Math.round((gmv * (100 - commission.effective)) / 100);

    // --- Rating: AVG + COUNT dari ratings venue ini. ---
    const ratingRow = await this.ratings
      .createQueryBuilder('r')
      .select('COUNT(*)', 'count')
      .addSelect('AVG(r.score)', 'avg')
      .where('r.venueId = :venueId', { venueId })
      .getRawOne<{ count: string; avg: string | null }>();
    const ratingCount = Number(ratingRow?.count ?? 0);
    const rating: VenueRatingSummary = {
      avg:
        ratingCount > 0 && ratingRow?.avg != null
          ? Math.round(Number(ratingRow.avg) * 100) / 100
          : null,
      count: ratingCount,
    };

    // --- Top courts: booking paid per court (LEFT JOIN agar court tanpa
    // booking tetap muncul dengan 0), urut gmv DESC. ---
    const topRaw =
      courtIds.length > 0
        ? await this.courts
            .createQueryBuilder('c')
            .select('c.id', 'courtId')
            .addSelect('COUNT(b.id)', 'booked')
            .addSelect('COALESCE(SUM(b.amount), 0)', 'gmv')
            .leftJoin(
              Booking,
              'b',
              "b.court_id = CAST(c.id AS TEXT) AND b.status = 'paid'",
            )
            .where('c.venueId = :venueId', { venueId })
            .groupBy('c.id')
            .getRawMany<{ courtId: string; booked: string; gmv: string }>()
        : [];
    const gmvByCourt = new Map(
      topRaw.map((r) => [
        r.courtId,
        { booked: Number(r.booked), gmv: Number(r.gmv) },
      ]),
    );
    const topCourts: TopCourtStat[] = venueCourts
      .map((c) => ({
        courtId: c.id,
        courtName: c.name,
        booked: gmvByCourt.get(c.id)?.booked ?? 0,
        gmv: gmvByCourt.get(c.id)?.gmv ?? 0,
      }))
      .sort((a, b) => b.gmv - a.gmv || b.booked - a.booked);

    return {
      venueId: venue.id,
      occupancy: { date: day, totalSlots, bookedSlots, pct },
      reservations: { total: reservationsTotal, byStatus },
      revenue: {
        paidCount,
        gmv,
        commissionPercent: commission.effective,
        net,
      },
      rating,
      topCourts,
    };
  }

  /**
   * GET /venues/mine — venue milik user login (ringkas).
   * super_admin boleh `?all=true` untuk semua venue; venue_owner yang
   * mengirim `all=true` → 403. Default: milik sendiri.
   */
  async listMine(
    actor: ActorInput,
    all?: boolean,
  ): Promise<{ data: MineVenueItem[]; meta: { total: number } }> {
    if (all) {
      if (actor.role !== 'super_admin') {
        throw new ForbiddenException('Only super_admin can list all venues');
      }
      return this.listWhere({});
    }
    return this.listWhere({ ownerId: actor.id });
  }

  private async listWhere(
    where: Record<string, unknown>,
  ): Promise<{ data: MineVenueItem[]; meta: { total: number } }> {
    const rows = await this.venues.find({
      where,
      order: { createdAt: 'DESC' },
    });
    if (rows.length === 0) return { data: [], meta: { total: 0 } };
    const ids = rows.map((v) => v.id);
    const counts = await this.courts
      .createQueryBuilder('c')
      .select('c.venueId', 'venueId')
      .addSelect('COUNT(*)', 'count')
      .where('c.venueId IN (:...ids)', { ids })
      .groupBy('c.venueId')
      .getRawMany<{ venueId: string; count: string }>();
    const byVenue = new Map(counts.map((r) => [r.venueId, Number(r.count)]));
    return {
      data: rows.map((v) => ({
        id: v.id,
        name: v.name,
        status: v.status,
        courtsCount: byVenue.get(v.id) ?? 0,
      })),
      meta: { total: rows.length },
    };
  }
}
