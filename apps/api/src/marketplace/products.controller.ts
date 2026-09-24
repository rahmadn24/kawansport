import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AccessPayload } from '../auth/jwt-auth.guard';
import type { RequestUser } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { isPendingChange } from '../change-requests/change-requests.service';
import type { UserRole } from '../users/user.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsDto } from './dto/list-products.dto';
import { RejectDto } from './dto/reject.dto';
import { SellerDashboardQueryDto } from './dto/seller-dashboard-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly products: ProductsService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Buat produk (MP-01). Hanya seller approved milik sendiri (403 bila
   * belum punya profil / belum approved). Produk baru langsung `pending`.
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateProductDto) {
    return this.products.create(user, dto);
  }

  /**
   * Daftar produk PUBLIK — hanya yang `approved`.
   * Filter search/category/seller + pagination + meta.
   */
  @Get()
  list(@Query() query: ListProductsDto) {
    return this.products.list(query);
  }

  /** Antrean produk pending (khusus super_admin). */
  @Get('pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  listPending() {
    return this.products.listPending();
  }

  /**
   * Produk milik toko sendiri — SEMUA status (pending/approved/rejected),
   * shape ProductItem yang sama + meta. WAJIB sebelum rute `:id` agar
   * `mine` tidak ditangkap sebagai UUID.
   */
  @Get('mine')
  @UseGuards(JwtAuthGuard)
  listMine(
    @CurrentUser() user: RequestUser,
    @Query() query: SellerDashboardQueryDto,
  ) {
    return this.products.listMine(user, query);
  }

  /**
   * Detail produk. Publik bila `approved`; non-approved hanya terlihat
   * oleh pemiliknya / super_admin (selain itu 404 agar tidak bocor).
   * Auth opsional: tanpa token hanya approved yang terlihat.
   */
  @Get(':id')
  detail(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request,
  ) {
    return this.products.detail(id, this.extractOptionalActor(req));
  }

  /**
   * Ubah produk — hanya pemilik produk (via seller miliknya) atau
   * super_admin (403 bila lintas seller).
   * AD-02: edit field sensitif atas produk approved oleh seller → 202
   * change request (publik tetap data lama); admin / non-approved → 200.
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateProductDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.products.update(id, user, dto);
    if (isPendingChange(result)) res.status(202);
    return result;
  }

  /** Approve pending -> approved (khusus super_admin). */
  @Post(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  approve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.products.approve(id, user.id);
  }

  /** Reject pending -> rejected + alasan (khusus super_admin). */
  @Post(':id/reject')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  reject(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: RejectDto,
  ) {
    return this.products.reject(id, dto.reason, user.id);
  }

  /**
   * Aktor opsional untuk endpoint publik: bila ada Bearer token valid,
   * kembalikan { id, role } agar owner/admin bisa melihat produk miliknya
   * yang belum approved; tanpa token / token invalid → null (hanya
   * approved yang terlihat). Tidak pernah throw.
   */
  private extractOptionalActor(req: Request): { id: string; role: UserRole } | null {
    const header: string = req.headers?.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) return null;
    try {
      const payload = this.jwt.verify<AccessPayload>(token);
      if (!payload?.sub) return null;
      return { id: payload.sub, role: payload.role ?? 'user' };
    } catch {
      return null;
    }
  }
}
