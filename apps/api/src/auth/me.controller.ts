import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from '../users/users.service';
import { UpdateMeDto } from '../users/dto/update-me.dto';
import {
  AVATAR_MAX_BYTES,
  UploadedAvatarFile,
  avatarFileFilter,
  saveAvatarBuffer,
} from '../users/upload.config';
import { AccountService } from './account.service';
import { CurrentUser } from './current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('me')
export class MeController {
  constructor(
    private readonly users: UsersService,
    private readonly account: AccountService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: { id: string }) {
    const found = await this.users.findById(user.id);
    if (!found) return null;
    return this.users.toPublic(found);
  }

  @Patch()
  @UseGuards(JwtAuthGuard)
  async updateMe(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateMeDto,
  ) {
    const updated = await this.users.updateProfile(user.id, dto);
    return this.users.toPublic(updated);
  }

  /**
   * Upload avatar (SM-03, MVP local storage).
   * Request: multipart/form-data dengan field `avatar` (image, maks AVATAR_MAX_MB).
   * Response: { avatarUrl } — URL statis di bawah /uploads/.
   */
  @Post('avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('avatar', {
      limits: { fileSize: AVATAR_MAX_BYTES },
      fileFilter: avatarFileFilter,
    }),
  )
  async uploadAvatar(
    @CurrentUser() user: { id: string },
    @UploadedFile() file: UploadedAvatarFile | undefined,
  ) {
    if (!file) throw new BadRequestException('Field "avatar" (image) is required');
    const avatarUrl = await saveAvatarBuffer(user.id, file);
    await this.users.setAvatar(user.id, avatarUrl);
    return { avatarUrl };
  }

  /**
   * Hapus akun sendiri (GAP-02). Aturan blokir 409 (booking/order aktif,
   * event mendatang, venue, seller) + penghapusan sesi ada di AccountService
   * dan ENDPOINTS.md seksi GAP-02.
   */
  @Delete()
  @UseGuards(JwtAuthGuard)
  async deleteMe(@CurrentUser() user: { id: string }) {
    return this.account.deleteMe(user.id);
  }
}
