import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { UpdateVoucherDto } from './dto/update-voucher.dto';
import { VouchersService } from './vouchers.service';

/**
 * CRUD voucher promo (ST-04, khusus super_admin — pola guard sama dengan
 * AdminListsController). Tidak ada hard delete: nonaktifkan via deactivate
 * agar riwayat redeem (`voucher_redemptions` + snapshot di booking/order)
 * tetap utuh.
 */
@Controller('admin/vouchers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin')
export class VouchersController {
  constructor(private readonly vouchers: VouchersService) {}

  /** Buat voucher baru (code unik, case-insensitive). */
  @Post()
  create(@Body() dto: CreateVoucherDto) {
    return this.vouchers.create(dto);
  }

  /** Daftar semua voucher, terbaru dulu. */
  @Get()
  list() {
    return this.vouchers.list();
  }

  /** Detail satu voucher. */
  @Get(':id')
  getOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.vouchers.getOne(id);
  }

  /** Ubah parsial (code terkunci bila voucher sudah pernah dipakai). */
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateVoucherDto,
  ) {
    return this.vouchers.update(id, dto);
  }

  /** Nonaktifkan voucher (idempotent, tanpa hard delete). */
  @Post(':id/deactivate')
  @HttpCode(200)
  deactivate(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.vouchers.deactivate(id);
  }
}
