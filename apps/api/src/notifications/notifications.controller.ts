import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard, RequestUser } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { SendNotificationDto } from './dto/send-notification.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Post('register')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  register(@CurrentUser() user: RequestUser, @Body() dto: RegisterDeviceDto) {
    return this.notifications.registerToken(user, dto);
  }

  /** GAP-01: riwayat notifikasi milik sendiri. */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  listMine(@CurrentUser() user: RequestUser, @Query() query: ListNotificationsDto) {
    return this.notifications.listForUser(user.id, query.page ?? 1, query.limit ?? 20);
  }

  /** GAP-01: tandai dibaca (milik sendiri; lintas user → 404, idempotent). */
  @Post(':id/read')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  markRead(@CurrentUser() user: RequestUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.notifications.markRead(user.id, id);
  }

  @Post('send')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  send(@Body() dto: SendNotificationDto) {
    return this.notifications.sendToUsers(dto);
  }
}
