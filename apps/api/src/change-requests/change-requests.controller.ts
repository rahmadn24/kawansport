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
import type { RequestUser } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ChangeRequestsService } from './change-requests.service';
import { ListChangeRequestsDto } from './dto/list-change-requests.dto';
import { ReviewChangeRequestDto } from './dto/review-change-request.dto';

/**
 * Change requests (AD-02): edit field sensitif atas entity `approved`.
 * - Owner/seller: `GET /me/change-requests` (miliknya, + filter status).
 * - Admin: `GET /admin/change-requests?status=` + approve (terapkan payload
 *   ke entity) / reject (+reason). Entity publik tetap data lama sampai approve.
 */
@Controller()
export class ChangeRequestsController {
  constructor(private readonly changeRequests: ChangeRequestsService) {}

  /** Daftar change request milik sendiri (butuh JWT). */
  @Get('me/change-requests')
  @UseGuards(JwtAuthGuard)
  listMine(
    @CurrentUser() user: RequestUser,
    @Query() query: ListChangeRequestsDto,
  ) {
    return this.changeRequests.listMine(user.id, query);
  }

  /** Antrean change request (khusus super_admin). */
  @Get('admin/change-requests')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  listAll(@Query() query: ListChangeRequestsDto) {
    return this.changeRequests.listAll(query);
  }

  /** Approve: terapkan payload ke entity + tandai approved (super_admin). */
  @Post('admin/change-requests/:id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  approve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.changeRequests.approve(id, user.id);
  }

  /** Reject: entity tidak berubah + alasan (khusus super_admin). */
  @Post('admin/change-requests/:id/reject')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  reject(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: ReviewChangeRequestDto,
  ) {
    return this.changeRequests.reject(id, user.id, dto.reason);
  }
}
