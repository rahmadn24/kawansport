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
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateSellerDto } from './dto/create-seller.dto';
import { RejectDto } from './dto/reject.dto';
import { UpdateSellerDto } from './dto/update-seller.dto';
import { SellersService } from './sellers.service';

@Controller('sellers')
export class SellersController {
  constructor(private readonly sellers: SellersService) {}

  /**
   * Apply jadi seller (MP-01). Auth apa pun boleh; profil dibuat `pending`
   * dan role user tetap sampai admin approve. Duplikat apply → 409.
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateSellerDto) {
    return this.sellers.create(user, dto);
  }

  /** Profil seller milik sendiri (404 bila belum apply). */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMine(@CurrentUser() user: RequestUser) {
    return this.sellers.getMine(user);
  }

  /** Ubah toko milik sendiri (status tidak berubah). */
  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMine(@CurrentUser() user: RequestUser, @Body() dto: UpdateSellerDto) {
    return this.sellers.updateMine(user, dto);
  }

  /** Antrean seller pending (khusus super_admin). */
  @Get('pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  listPending() {
    return this.sellers.listPending();
  }

  /** Approve pending -> approved + role pemilik jadi `seller` (super_admin). */
  @Post(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  approve(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.sellers.approve(id);
  }

  /** Reject pending -> rejected + alasan (khusus super_admin). */
  @Post(':id/reject')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  reject(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RejectDto,
  ) {
    return this.sellers.reject(id, dto.reason);
  }
}
