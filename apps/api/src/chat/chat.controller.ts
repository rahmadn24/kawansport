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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChatService } from './chat.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ListMessagesDto } from './dto/list-messages.dto';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  /** Get-or-create conversation 1-1 berdasarkan partner_id. */
  @Post()
  getOrCreate(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateConversationDto,
  ) {
    return this.chat.getOrCreate(user.id, dto.partnerId);
  }

  /** List conversation milik current user + last message + unread count. */
  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.chat.list(user.id);
  }

  /** History pesan ASC + pagination ?page=&limit=. */
  @Get(':id/messages')
  history(
    @CurrentUser() user: { id: string },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: ListMessagesDto,
  ) {
    return this.chat.history(user.id, id, query.page ?? 1, query.limit ?? 20);
  }

  /** Tandai semua pesan lawan sebagai dibaca. */
  @Post(':id/read')
  @HttpCode(200)
  markRead(
    @CurrentUser() user: { id: string },
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.chat.markRead(user.id, id);
  }

  /**
   * Kirim pesan via REST (GAP-02) — jalur persist SAMA dengan WS
   * (`ChatService.send`: validasi anggota 403/404, trim + batas 2000 char,
   * update lastMessageAt; unread dihitung live saat baca).
   * Response 201 MessageItem. Broadcast WS realtime tetap lewat gateway.
   */
  @Post(':id/messages')
  sendMessage(
    @CurrentUser() user: { id: string },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chat.send(user.id, id, dto.body).then((r) => r.message);
  }
}
