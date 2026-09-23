import { Injectable } from '@nestjs/common';
import { DataSource, IsNull, Not } from 'typeorm';
import { Booking } from '../bookings/booking.entity';
import { ShopOrder } from '../marketplace/shop-order.entity';
import { User } from '../users/user.entity';
import { Voucher, VoucherRedemption } from '../vouchers/voucher.entity';

export type ActivityType =
  | 'booking_paid'
  | 'booking_checkin'
  | 'order_paid'
  | 'user_joined'
  | 'voucher_redeem';

export interface ActivityItem {
  type: ActivityType;
  at: Date;
  title: string;
  detail?: string;
  refType?: string;
  refId?: string;
}

/**
 * Activity feed admin (API-W04) — read-only agregasi lintas tabel, tanpa
 * tabel baru. Tiap sumber di-query `ORDER BY waktu DESC LIMIT N` lalu
 * digabung + merge-sort di memori (N kecil: `limit` maks 100 — sederhana
 * dan cepat, tanpa UNION SQL kompleks). Modul payout belum ada → di-skip
 * (bila modul payout lahir, tambah satu sumber di sini + satu tipe).
 */
@Injectable()
export class AdminActivityService {
  constructor(private readonly ds: DataSource) {}

  async getActivity(limit = 20): Promise<{ data: ActivityItem[] }> {
    const n = Math.min(Math.max(limit || 20, 1), 100);
    const bookingsRepo = this.ds.getRepository(Booking);
    const ordersRepo = this.ds.getRepository(ShopOrder);
    const usersRepo = this.ds.getRepository(User);
    const redemptionsRepo = this.ds.getRepository(VoucherRedemption);
    const vouchersRepo = this.ds.getRepository(Voucher);

    const [paidBookings, checkins, paidOrders, newUsers, redemptions] =
      await Promise.all([
        bookingsRepo.find({
          where: { status: 'paid' },
          order: { paidAt: 'DESC' },
          take: n,
        }),
        bookingsRepo.find({
          where: { checkedInAt: Not(IsNull()) },
          order: { checkedInAt: 'DESC' },
          take: n,
        }),
        ordersRepo.find({
          where: { status: 'paid' },
          order: { paidAt: 'DESC' },
          take: n,
        }),
        usersRepo.find({ order: { createdAt: 'DESC' }, take: n }),
        redemptionsRepo.find({ order: { createdAt: 'DESC' }, take: n }),
      ]);

    const voucherCodes = new Map<string, string>();
    if (redemptions.length > 0) {
      const ids = [...new Set(redemptions.map((r) => r.voucherId))];
      const vouchers = await vouchersRepo.find({ where: ids.map((id) => ({ id })) });
      for (const v of vouchers) voucherCodes.set(v.id, v.code);
    }

    const items: ActivityItem[] = [
      ...paidBookings.map(
        (b): ActivityItem => ({
          type: 'booking_paid',
          at: b.paidAt ?? b.createdAt,
          title: 'Booking lunas',
          detail: `${b.paymentRef} · Rp${b.amount}`,
          refType: 'booking',
          refId: b.id,
        }),
      ),
      ...checkins.map(
        (b): ActivityItem => ({
          type: 'booking_checkin',
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          at: b.checkedInAt!,
          title: 'Check-in booking',
          detail: b.code ?? b.paymentRef,
          refType: 'booking',
          refId: b.id,
        }),
      ),
      ...paidOrders.map(
        (o): ActivityItem => ({
          type: 'order_paid',
          at: o.paidAt ?? o.createdAt,
          title: 'Order lunas',
          detail: `${o.paymentRef} · Rp${o.total}`,
          refType: 'order',
          refId: o.id,
        }),
      ),
      ...newUsers.map(
        (u): ActivityItem => ({
          type: 'user_joined',
          at: u.createdAt,
          title: 'User baru',
          detail: u.email,
          refType: 'user',
          refId: u.id,
        }),
      ),
      ...redemptions.map(
        (r): ActivityItem => ({
          type: 'voucher_redeem',
          at: r.createdAt,
          title: 'Voucher dipakai',
          detail: voucherCodes.get(r.voucherId) ?? r.voucherId,
          refType: r.bookingId ? 'booking' : 'order',
          refId: r.bookingId ?? r.orderId ?? r.id,
        }),
      ),
    ];

    items.sort((a, b) => timeOf(b.at) - timeOf(a.at));
    return { data: items.slice(0, n) };
  }
}

function timeOf(d: Date): number {
  return new Date(d).getTime();
}
