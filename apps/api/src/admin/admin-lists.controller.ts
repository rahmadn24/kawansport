import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { BookingsService } from '../bookings/bookings.service';
import { OrdersService } from '../marketplace/orders.service';
import { ProductsService } from '../marketplace/products.service';
import { SellersService } from '../marketplace/sellers.service';
import type { UserRole } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { VenuesService } from '../venues/venues.service';
import {
  AdminProductsQueryDto,
  AdminSellersQueryDto,
  AdminStatusQueryDto,
  AdminUsersQueryDto,
  AdminVenuesQueryDto,
} from './dto/admin-lists.dto';

/**
 * Daftar read-only untuk CMS (AD-02, khusus super_admin).
 * Semua endpoint di sini HANYA membaca — tidak ada mutasi.
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin')
export class AdminListsController {
  constructor(
    private readonly venues: VenuesService,
    private readonly products: ProductsService,
    private readonly sellers: SellersService,
    private readonly users: UsersService,
    private readonly bookings: BookingsService,
    private readonly orders: OrdersService,
  ) {}

  /** Semua venue (filter `status`: draft/pending/approved/rejected). */
  @Get('venues')
  listVenues(@Query() query: AdminVenuesQueryDto) {
    return this.venues.listForAdmin(
      query.status as 'draft' | 'pending' | 'approved' | 'rejected' | undefined,
    );
  }

  /** Semua produk (filter `status`: draft/pending/approved/rejected). */
  @Get('products')
  listProducts(@Query() query: AdminProductsQueryDto) {
    return this.products.listForAdmin(
      query.status as
        | 'draft'
        | 'pending'
        | 'approved'
        | 'rejected'
        | undefined,
    );
  }

  /** Semua seller (filter `status`: pending/approved/rejected). */
  @Get('sellers')
  listSellers(@Query() query: AdminSellersQueryDto) {
    return this.sellers.listAll(
      query.status as 'pending' | 'approved' | 'rejected' | undefined,
    );
  }

  /** Semua user (filter `role` + `search` + pagination). */
  @Get('users')
  listUsers(@Query() query: AdminUsersQueryDto) {
    return this.users.listForAdmin({
      role: query.role as UserRole | undefined,
      search: query.search,
      page: query.page,
      limit: query.limit,
    });
  }

  /** Semua booking (filter `status`: pending/paid/expired/cancelled). */
  @Get('bookings')
  listBookings(@Query() query: AdminStatusQueryDto) {
    return this.bookings.listForAdmin(query.status);
  }

  /** Semua order marketplace (filter `status`: pending/paid/...). */
  @Get('orders')
  listOrders(@Query() query: AdminStatusQueryDto) {
    return this.orders.listForAdmin(query.status);
  }
}
