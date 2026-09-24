import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { Conversation, sortPair } from './conversation.entity';
import { Message } from './message.entity';

export interface ChatPartner {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface MessageItem {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: Date;
  readAt: Date | null;
}

export interface ConversationItem {
  id: string;
  partner: ChatPartner;
  lastMessage: MessageItem | null;
  unreadCount: number;
  lastMessageAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversations: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messages: Repository<Message>,
    private readonly users: UsersService,
  ) {}

  private isMember(c: Conversation, userId: string): boolean {
    return c.userA === userId || c.userB === userId;
  }

  private partnerIdOf(c: Conversation, userId: string): string {
    return c.userA === userId ? c.userB : c.userA;
  }

  private async partnerOf(c: Conversation, userId: string): Promise<ChatPartner> {
    const u = await this.users.findById(this.partnerIdOf(c, userId));
    if (!u) throw new NotFoundException('Partner not found');
    return {
      id: u.id,
      email: u.email,
      displayName: u.displayName ?? null,
      avatarUrl: u.avatarUrl ?? null,
    };
  }

  toMessageItem(m: Message): MessageItem {
    return {
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      body: m.body,
      createdAt: m.createdAt,
      readAt: m.readAt ?? null,
    };
  }

  /** POST /conversations — get-or-create berdasarkan pasangan terurut. */
  async getOrCreate(myId: string, partnerId: string): Promise<ConversationItem> {
    if (partnerId === myId) {
      throw new BadRequestException('Cannot chat with yourself');
    }
    const partner = await this.users.findById(partnerId);
    if (!partner) throw new NotFoundException('Partner not found');

    const [userA, userB] = sortPair(myId, partnerId);
    let conv = await this.conversations.findOne({ where: { userA, userB } });
    if (!conv) {
      try {
        conv = await this.conversations.save(
          this.conversations.create({ userA, userB }),
        );
      } catch {
        // Balapan get-or-create bersamaan: unique pair melarang duplikat.
        const raced = await this.conversations.findOne({ where: { userA, userB } });
        if (!raced) throw new BadRequestException('Failed to create conversation');
        conv = raced;
      }
    }
    return this.toItem(conv, myId);
  }

  /** GET /conversations — list milik current user + last message + unread count. */
  async list(myId: string): Promise<{ data: ConversationItem[] }> {
    const convs = await this.conversations.find({
      where: [{ userA: myId }, { userB: myId }],
      order: { lastMessageAt: 'DESC' },
    });
    // NULLS LAST eksplisit: sqljs/postgres menaruh NULL sesuai default berbeda.
    convs.sort((a, b) => {
      const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : -1;
      const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : -1;
      return tb - ta;
    });
    const data = await Promise.all(convs.map((c) => this.toItem(c, myId)));
    return { data };
  }

  /** GET /conversations/:id/messages — ASC + pagination page/limit. */
  async history(
    myId: string,
    conversationId: string,
    page: number,
    limit: number,
  ): Promise<{ data: MessageItem[]; meta: { page: number; limit: number; total: number } }> {
    const conv = await this.requireMember(conversationId, myId);
    const [rows, total] = await this.messages.findAndCount({
      where: { conversationId: conv.id },
      order: { createdAt: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data: rows.map((m) => this.toMessageItem(m)),
      meta: { page, limit, total },
    };
  }

  /** POST /conversations/:id/read — tandai semua pesan lawan sebagai dibaca. */
  async markRead(
    myId: string,
    conversationId: string,
  ): Promise<{ ok: boolean; marked: number }> {
    const conv = await this.requireMember(conversationId, myId);
    const res = await this.messages.update(
      { conversationId: conv.id, senderId: Not(myId), readAt: IsNull() },
      { readAt: () => 'CURRENT_TIMESTAMP' },
    );
    return { ok: true, marked: res.affected ?? 0 };
  }

  /**
   * Kirim pesan — dipakai WS gateway (`message:send`) DAN REST
   * (`POST /conversations/:id/messages`, GAP-02). Satu jalur persist:
   * verifikasi anggota, trim + batas 2000 char, update lastMessageAt.
   * Unread dihitung live saat baca (lihat `unreadOf` / `toItem`).
   */
  async send(
    senderId: string,
    conversationId: string,
    rawBody: string,
  ): Promise<{ message: MessageItem; partnerId: string }> {
    const conv = await this.requireMember(conversationId, senderId);
    const body = rawBody.trim();
    if (!body) throw new BadRequestException('Message body must not be empty');
    if (body.length > 2000) {
      throw new BadRequestException('Message body too long (max 2000)');
    }
    const saved = await this.messages.save(
      this.messages.create({ conversationId: conv.id, senderId, body }),
    );
    conv.lastMessageAt = saved.createdAt;
    await this.conversations.save(conv);
    const fresh = await this.messages.findOne({ where: { id: saved.id } });
    return {
      message: this.toMessageItem(fresh ?? saved),
      partnerId: this.partnerIdOf(conv, senderId),
    };
  }

  /** Unread count milik user pada satu conversation (pesan lawan, readAt null). */
  async unreadOf(conversationId: string, myId: string): Promise<number> {
    return this.messages.count({
      where: { conversationId, senderId: Not(myId), readAt: IsNull() },
    });
  }

  async requireMember(conversationId: string, myId: string): Promise<Conversation> {
    const conv = await this.conversations.findOne({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException('Conversation not found');
    if (!this.isMember(conv, myId)) throw new ForbiddenException('Not a member');
    return conv;
  }

  private async toItem(c: Conversation, myId: string): Promise<ConversationItem> {
    const [partner, last, unreadCount] = await Promise.all([
      this.partnerOf(c, myId),
      this.messages.findOne({
        where: { conversationId: c.id },
        order: { createdAt: 'DESC' },
      }),
      this.messages.count({
        where: { conversationId: c.id, senderId: Not(myId), readAt: IsNull() },
      }),
    ]);
    return {
      id: c.id,
      partner,
      lastMessage: last ? this.toMessageItem(last) : null,
      unreadCount,
      lastMessageAt: c.lastMessageAt ?? null,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }
}
