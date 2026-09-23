import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard, RequestUser } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreatePayoutDto } from './dto/create-payout.dto';
import {
  ApprovePayoutDto,
  BalanceQueryDto,
  ListPayoutsQueryDto,
  PayPayoutDto,
  RejectPayoutDto,
} from './dto/handle-payout.dto';
import { PayoutsService } from './payouts.service';

/**
 * Payout & withdraw mitra (API-W08, catat-dan-approve manual).
 * - Mitra (venue_owner / seller, super_admin): `POST /payouts`,
 *   `GET /payouts/me`, `GET /payouts/balance`.
 * - Super_admin: `GET /payouts?status=`, `POST /payouts/:id/approve`,
 *   `POST /payouts/:id/reject`, `POST /payouts/:id/pay`.
 */
@Controller('payouts')
export class PayoutsController {
  constructor(private readonly payouts: PayoutsService) {}

  /** Ajukan withdraw (amount ≤ saldo tersedia, else 409; lintas owner 403). */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('venue_owner', 'seller', 'super_admin')
  async create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreatePayoutDto,
  ) {
    return this.payouts.create(user, dto);
  }

  /** Saldo read-only (live dari booking/order paid − payout approved/paid). */
  @Get('balance')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('venue_owner', 'seller', 'super_admin')
  async balance(
    @CurrentUser() user: RequestUser,
    @Query() query: BalanceQueryDto,
  ) {
    return this.payouts.balance(user, query.payeeType, query.payeeId);
  }

  /** Riwayat payout milik sendiri. */
  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('venue_owner', 'seller', 'super_admin')
  async listMine(@CurrentUser() user: RequestUser) {
    return this.payouts.listMine(user);
  }

  /** Antrean payout (khusus super_admin) + filter `status?`. */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  async listForAdmin(@Query() query: ListPayoutsQueryDto) {
    return this.payouts.listForAdmin(query.status);
  }

  /** requested → approved (khusus super_admin); selain itu 409. */
  @Post(':id/approve')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  async approve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: ApprovePayoutDto,
  ) {
    return this.payouts.approve(id, user, dto);
  }

  /** requested → rejected (khusus super_admin); selain itu 409. */
  @Post(':id/reject')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  async reject(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: RejectPayoutDto,
  ) {
    return this.payouts.reject(id, user, dto);
  }

  /** approved → paid, reference wajib (khusus super_admin); selain itu 409. */
  @Post(':id/pay')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  async markPaid(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: PayPayoutDto,
  ) {
    return this.payouts.markPaid(id, user, dto);
  }
}
