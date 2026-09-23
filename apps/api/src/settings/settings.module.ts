import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { AdminSettingsController } from './admin-settings.controller';
import { PlatformSetting } from './platform-setting.entity';
import { SettingsService } from './settings.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PlatformSetting]),
    AuthModule,
    UsersModule,
  ],
  controllers: [AdminSettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
