import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard, RequestUser } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
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

  @Post('send')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  send(@Body() dto: SendNotificationDto) {
    return this.notifications.sendToUsers(dto);
  }
}
