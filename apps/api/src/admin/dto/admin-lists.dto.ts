import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { USER_ROLES } from '../../users/user.entity';
import { VENUE_STATUSES } from '../../venues/venue.entity';
import { PRODUCT_STATUSES } from '../../marketplace/product.entity';
import { SELLER_STATUSES } from '../../marketplace/seller.entity';

/** Query GET /admin/venues — filter status moderasi opsional. */
export class AdminVenuesQueryDto {
  @IsOptional()
  @IsIn(VENUE_STATUSES)
  status?: string;
}

/** Query GET /admin/products — filter status moderasi opsional. */
export class AdminProductsQueryDto {
  @IsOptional()
  @IsIn(PRODUCT_STATUSES)
  status?: string;
}

/** Query GET /admin/sellers — filter status moderasi opsional. */
export class AdminSellersQueryDto {
  @IsOptional()
  @IsIn(SELLER_STATUSES)
  status?: string;
}

/** Query GET /admin/bookings + /admin/orders — filter status opsional. */
export class AdminStatusQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  status?: string;
}

/** Query GET /admin/users — filter role + search + pagination. */
export class AdminUsersQueryDto {
  @IsOptional()
  @IsIn(USER_ROLES)
  role?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
