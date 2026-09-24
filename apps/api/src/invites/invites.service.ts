import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatService } from '../chat/chat.service';
import { UsersService } from '../users/users.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { Invite } from './invite.entity';

@Injectable()
export class InvitesService {
  constructor(
    @InjectRepository(Invite)
    private readonly invites: Repository<Invite>,
    private readonly users: UsersService,
    private readonly chat: ChatService,
  ) {}

  private toItem(i: Invite) {
    return {
      id: i.id,
      fromUserId: i.fromUserId,
      toUserId: i.toUserId,
      sport: i.sport ?? null,
      message: i.message ?? null,
      status: i.status,
      eventId: i.eventId ?? null,
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
    };
  }

  async create(fromUserId: string, dto: CreateInviteDto) {
    if (dto.toUserId === fromUserId) {
      throw new BadRequestException('Cannot invite yourself');
    }
    const toUser = await this.users.findById(dto.toUserId);
    if (!toUser) throw new NotFoundException('Target user not found');

    // Duplikat: masih ada pending dari pengirim yg sama ke penerima yg sama
    // untuk event yg sama (null-safe).
    const pendings = await this.invites.find({
      where: { fromUserId, toUserId: dto.toUserId, status: 'pending' },
    });
    const dup = pendings.find(
      (p) => (p.eventId ?? null) === (dto.eventId ?? null),
    );
    if (dup) throw new ConflictException('Invite already pending');

    const row = this.invites.create({
      fromUserId,
      toUserId: dto.toUserId,
      sport: dto.sport ?? null,
      message: dto.message ?? null,
      status: 'pending',
      eventId: dto.eventId ?? null,
    });
    const saved = await this.invites.save(row);
    return this.toItem(saved);
  }

  /** Default masuk (untukku); ?dir=sent = keluar (dariku). */
  async listMine(myId: string, dir?: 'in' | 'sent') {
    const rows = await this.invites.find({
      where: dir === 'sent' ? { fromUserId: myId } : { toUserId: myId },
      order: { createdAt: 'DESC' },
    });
    return { data: rows.map((r) => this.toItem(r)) };
  }

  private async requireInvite(id: string) {
    const inv = await this.invites.findOne({ where: { id } });
    if (!inv) throw new NotFoundException('Invite not found');
    return inv;
  }

  async accept(myId: string, id: string) {
    const inv = await this.requireInvite(id);
    if (inv.toUserId !== myId) throw new ForbiddenException('Only recipient can accept');
    if (inv.status !== 'pending') throw new ConflictException(`Invite already ${inv.status}`);
    inv.status = 'accepted';
    await this.invites.save(inv);
    const conversation = await this.chat.getOrCreate(inv.fromUserId, inv.toUserId);
    return { ...this.toItem(inv), conversation };
  }

  async decline(myId: string, id: string) {
    const inv = await this.requireInvite(id);
    if (inv.toUserId !== myId) throw new ForbiddenException('Only recipient can decline');
    if (inv.status !== 'pending') throw new ConflictException(`Invite already ${inv.status}`);
    inv.status = 'declined';
    await this.invites.save(inv);
    return this.toItem(inv);
  }
}
