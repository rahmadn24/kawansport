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
import { DisputesService } from './disputes.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { ListDisputesQueryDto } from './dto/list-disputes.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';

/**
 * Dispute center (API-W02).
 * - User login: `POST /disputes`, `GET /disputes/me`.
 * - Super_admin: `GET /disputes?status=`, `POST /disputes/:id/investigate`,
 *   `POST /disputes/:id/resolve`.
 */
@Controller('disputes')
export class DisputesController {
  constructor(private readonly disputes: DisputesService) {}

  /** Buat laporan untuk diri sendiri → 201. */
  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateDisputeDto,
  ) {
    return this.disputes.create(user, dto);
  }

  /** Daftar laporan milik sendiri (reporter hanya lihat miliknya). */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async listMine(@CurrentUser() user: RequestUser) {
    return this.disputes.listMine(user);
  }

  /** Antrean moderasi (khusus super_admin) + filter `status?`. */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  async listForAdmin(@Query() query: ListDisputesQueryDto) {
    return this.disputes.listForAdmin(query.status);
  }

  /** `open` → `investigating` (khusus super_admin); selain itu 409. */
  @Post(':id/investigate')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  async investigate(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.disputes.investigate(id);
  }

  /** Putusan akhir admin (khusus super_admin). */
  @Post(':id/resolve')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  async resolve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.disputes.resolve(id, user, dto);
  }
}
