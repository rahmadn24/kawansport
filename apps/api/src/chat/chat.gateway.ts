import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';

interface WsClient extends Socket {
  data: { userId?: string; email?: string };
}

const roomOf = (conversationId: string) => `conversation:${conversationId}`;
const userRoomOf = (userId: string) => `user:${userId}`;

/**
 * Gateway chat 1-1 (SM-07, Socket.io).
 *
 * Auth: JWT access token via `handshake.auth.token` (disarankan) atau
 * `handshake.query.token`. Koneksi tanpa token valid langsung ditolak.
 *
 * Events:
 * - client -> `join` { conversationId }: verifikasi membership lalu join room.
 * - client -> `message:send` { conversationId, body }: persist, broadcast
 *   `message:new` ke room conversation + `conversation:update` (unread) ke
 *   personal room kedua belah pihak.
 */
@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chat: ChatService,
    private readonly jwt: JwtService,
  ) {}

  private extractToken(client: Socket): string | null {
    const auth = client.handshake.auth as Record<string, unknown> | undefined;
    const fromAuth = typeof auth?.token === 'string' ? (auth.token as string) : null;
    if (fromAuth) return fromAuth;
    const q = client.handshake.query?.token;
    if (typeof q === 'string' && q) return q;
    return null;
  }

  async handleConnection(client: WsClient) {
    const token = this.extractToken(client);
    if (!token) {
      this.logger.warn(`WS rejected (no token): ${client.id}`);
      client.disconnect();
      return;
    }
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; email: string }>(token);
      client.data.userId = payload.sub;
      client.data.email = payload.email;
      await client.join(userRoomOf(payload.sub));
      this.logger.log(`WS connected: ${client.id} (user ${payload.sub})`);
    } catch {
      this.logger.warn(`WS rejected (bad token): ${client.id}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: WsClient) {
    this.logger.log(`WS disconnected: ${client.id} (user ${client.data.userId ?? '?'})`);
  }

  @SubscribeMessage('join')
  async onJoin(
    @ConnectedSocket() client: WsClient,
    @MessageBody() payload: { conversationId?: string },
  ) {
    const userId = client.data.userId;
    if (!userId) return { ok: false, error: 'Unauthorized' };
    const conversationId = payload?.conversationId;
    if (!conversationId) return { ok: false, error: 'conversationId required' };
    try {
      await this.chat.requireMember(conversationId, userId);
      await client.join(roomOf(conversationId));
      return { ok: true, conversationId };
    } catch {
      return { ok: false, error: 'Not a member' };
    }
  }

  @SubscribeMessage('message:send')
  async onSend(
    @ConnectedSocket() client: WsClient,
    @MessageBody() payload: { conversationId?: string; body?: string },
  ) {
    const userId = client.data.userId;
    if (!userId) return { ok: false, error: 'Unauthorized' };
    const conversationId = payload?.conversationId;
    const body = payload?.body;
    if (!conversationId || typeof body !== 'string') {
      return { ok: false, error: 'conversationId and body required' };
    }
    try {
      const { message, partnerId } = await this.chat.send(userId, conversationId, body);
      // Broadcast pesan ke room conversation (kedua anggota yang join).
      this.server.to(roomOf(conversationId)).emit('message:new', message);
      // Update unread/badge ke personal room kedua belah pihak.
      const [senderUnread, partnerUnread] = await Promise.all([
        this.chat.unreadOf(conversationId, userId),
        this.chat.unreadOf(conversationId, partnerId),
      ]);
      this.server.to(userRoomOf(userId)).emit('conversation:update', {
        conversationId,
        lastMessage: message,
        unreadCount: senderUnread,
      });
      this.server.to(userRoomOf(partnerId)).emit('conversation:update', {
        conversationId,
        lastMessage: message,
        unreadCount: partnerUnread,
      });
      return { ok: true, message };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Send failed';
      return { ok: false, error: msg };
    }
  }
}
