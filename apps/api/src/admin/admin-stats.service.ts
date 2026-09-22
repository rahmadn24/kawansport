import { Injectable } from '@nestjs/common';
import { DataSource, Between } from 'typeorm';
import { User, UserRole } from '../users/user.entity';
import { Venue, VenueStatus } from '../venues/venue.entity';
import { Booking, BookingStatus } from '../bookings/booking.entity';
import { ShopOrder, ShopOrderGroup, ShopOrderItem, ShopOrderStatus } from '../marketplace/shop-order.entity';
import { Court } from '../venues/court.entity';
import { Product } from '../marketplace/product.entity';

@Injectable()
export class AdminStatsService {
  constructor(private readonly ds: DataSource) {}

  async getStats(from?: Date, to?: Date) {
    const toDate = to ?? new Date();
    const fromDate = from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const usersRepo = this.ds.getRepository(User);
    const venuesRepo = this.ds.getRepository(Venue);
    const bookingsRepo = this.ds.getRepository(Booking);
    const ordersRepo = this.ds.getRepository(ShopOrder);
    const courtsRepo = this.ds.getRepository(Court);
    const productsRepo = this.ds.getRepository(Product);

    // users
    const totalUsers = await usersRepo.count();
    const active7d = await usersRepo.count({
      where: { lastLoginAt: Between(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), toDate) },
    });
    const active30d = await usersRepo.count({
      where: { lastLoginAt: Between(fromDate, toDate) },
    });
    const byRoleRaw = await usersRepo
      .createQueryBuilder('u')
      .select('u.role', 'role')
      .addSelect('COUNT(*)', 'count')
      .groupBy('u.role')
      .getRawMany();
    const byRole: Record<string, number> = {};
    for (const r of byRoleRaw) {
      byRole[r.role] = Number(r.count);
    }

    // venues
    const totalVenues = await venuesRepo.count();
    const approvedVenues = await venuesRepo.count({ where: { status: 'approved' as VenueStatus } });
    const pendingVenues = await venuesRepo.count({ where: { status: 'pending' as VenueStatus } });
    const rejectedVenues = await venuesRepo.count({ where: { status: 'rejected' as VenueStatus } });

    // bookings
    const bookingQB = bookingsRepo.createQueryBuilder('b');
    if (fromDate && toDate) {
      bookingQB.where('b.createdAt BETWEEN :from AND :to', { from: fromDate, to: toDate });
    }
    const totalBookings = await bookingQB.getCount();
    const paidBookings = await bookingQB.clone().andWhere('b.status = :s', { s: 'paid' as BookingStatus }).getCount();
    const pendingBookings = await bookingQB.clone().andWhere('b.status = :s', { s: 'pending' as BookingStatus }).getCount();
    const expiredBookings = await bookingQB.clone().andWhere('b.status = :s', { s: 'expired' as BookingStatus }).getCount();
    const cancelledBookings = await bookingQB.clone().andWhere('b.status = :s', { s: 'cancelled' as BookingStatus }).getCount();
    const gmvBookings = await bookingsRepo
      .createQueryBuilder('b')
      .select('COALESCE(SUM(b.amount), 0)', 'sum')
      .where('b.status = :s', { s: 'paid' as BookingStatus })
      .andWhere('b.createdAt BETWEEN :from AND :to', { from: fromDate, to: toDate })
      .getRawOne();

    // orders
    const orderQB = ordersRepo.createQueryBuilder('o');
    if (fromDate && toDate) {
      orderQB.where('o.createdAt BETWEEN :from AND :to', { from: fromDate, to: toDate });
    }
    const totalOrders = await orderQB.getCount();
    const paidOrders = await orderQB.clone().andWhere('o.status = :s', { s: 'paid' as ShopOrderStatus }).getCount();
    const pendingOrders = await orderQB.clone().andWhere('o.status = :s', { s: 'pending' as ShopOrderStatus }).getCount();
    const expiredOrders = await orderQB.clone().andWhere('o.status = :s', { s: 'expired' as ShopOrderStatus }).getCount();
    const cancelledOrders = await orderQB.clone().andWhere('o.status = :s', { s: 'cancelled' as ShopOrderStatus }).getCount();
    const gmvOrders = await ordersRepo
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.total), 0)', 'sum')
      .where('o.status = :s', { s: 'paid' as ShopOrderStatus })
      .andWhere('o.createdAt BETWEEN :from AND :to', { from: fromDate, to: toDate })
      .getRawOne();

    // topSports: courts booked + products ordered.
    // Relasi Venue.bookings / Product.orderItems tidak ada di entity, jadi
    // join memakai entity + ON berbasis kolom FK nyata (hasil agregasi sama:
    // court yg punya booking paid + item di order paid, per sport/kategori).
    const topSportsCourts = await courtsRepo
      .createQueryBuilder('c')
      .select('c.sport', 'sport')
      .addSelect('COUNT(*)', 'count')
      .leftJoin('c.venue', 'v')
      .leftJoin(Booking, 'b', "b.court_id = CAST(c.id AS TEXT) AND b.status = 'paid'")
      .where('b.id IS NOT NULL')
      .andWhere('c.sport IS NOT NULL')
      .groupBy('c.sport')
      .getRawMany();

    const topSportsProducts = await productsRepo
      .createQueryBuilder('p')
      .select('p.category', 'sport')
      .addSelect('COUNT(oi.id)', 'count')
      .leftJoin(ShopOrderItem, 'oi', 'oi.product_id = CAST(p.id AS TEXT)')
      .leftJoin(ShopOrderGroup, 'og', 'CAST(og.id AS TEXT) = oi.group_id')
      .leftJoin(ShopOrder, 'o', "CAST(o.id AS TEXT) = og.order_id AND o.status = 'paid'")
      .where('o.id IS NOT NULL')
      .andWhere('p.category IS NOT NULL')
      .groupBy('p.category')
      .getRawMany();

    const sportCounts = new Map<string, number>();
    for (const r of [...topSportsCourts, ...topSportsProducts]) {
      sportCounts.set(r.sport, (sportCounts.get(r.sport) || 0) + Number(r.count));
    }
    const topSports = Array.from(sportCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([sport, count]) => ({ sport, count }));

    return {
      range: { from: fromDate.toISOString(), to: toDate.toISOString() },
      users: { total: totalUsers, active7d, active30d, byRole },
      venues: { total: totalVenues, approved: approvedVenues, pending: pendingVenues, rejected: rejectedVenues },
      bookings: {
        total: totalBookings,
        paid: paidBookings,
        pending: pendingBookings,
        expired: expiredBookings,
        cancelled: cancelledBookings,
        gmv: Number(gmvBookings?.sum || 0),
      },
      orders: {
        total: totalOrders,
        paid: paidOrders,
        pending: pendingOrders,
        expired: expiredOrders,
        cancelled: cancelledOrders,
        gmv: Number(gmvOrders?.sum || 0),
      },
      topSports,
    };
  }
}