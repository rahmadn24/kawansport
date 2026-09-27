import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { ActorInput } from '../auth/ownership';
import type { MatchItem } from '../elo/elo.service';
import { MatchResult } from '../elo/match-result.entity';
import { User } from '../users/user.entity';
import { Venue } from '../venues/venue.entity';
import type { CreateTournamentDto } from './dto/create-tournament.dto';
import { Tournament, type TournamentStatus } from './tournament.entity';

export interface TournamentItem {
  id: string;
  name: string;
  sport: string;
  venueId: string | null;
  createdBy: string;
  participantIds: string[];
  status: TournamentStatus;
  winnerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TournamentDetail extends TournamentItem {
  fixtures: MatchItem[];
}

@Injectable()
export class TournamentsService {
  constructor(
    @InjectRepository(Tournament)
    private readonly tournaments: Repository<Tournament>,
    @InjectRepository(MatchResult)
    private readonly matches: Repository<MatchResult>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Venue)
    private readonly venues: Repository<Venue>,
  ) {}

  /** POST /tournaments — buat turnamen (status awal `draft`). */
  async create(actor: ActorInput, dto: CreateTournamentDto): Promise<TournamentItem> {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Name must not be empty');
    const sport = dto.sport.trim();
    if (!sport) throw new BadRequestException('Sport must not be empty');
    const participantIds = [...new Set(dto.participantIds)];
    if (participantIds.length !== dto.participantIds.length) {
      throw new BadRequestException('participantIds must be unique');
    }
    await this.assertUsersExist(participantIds);
    if (dto.venueId) {
      const venue = await this.venues.findOne({ where: { id: dto.venueId } });
      if (!venue) throw new NotFoundException('Venue not found');
    }
    const tournament = this.tournaments.create({
      name,
      sport,
      venueId: dto.venueId ?? null,
      createdBy: actor.id,
      participantIds,
      status: 'draft',
      winnerId: null,
    });
    return this.toPublic(await this.tournaments.save(tournament));
  }

  /**
   * POST /tournaments/:id/generate — susun fixture round-robin 1v1
   * (circle-method: semua pasangan tak-terurut tepat sekali,
   * n·(n−1)/2 fixture) + tandai turnamen `ongoing`.
   * Hanya creator / super_admin, hanya dari `draft`. Generate ulang saat
   * `ongoing`/`done`/`cancelled` → 409 (idempotent — TANPA duplikat fixture).
   */
  async generate(
    actor: ActorInput,
    id: string,
  ): Promise<TournamentDetail> {
    const tournament = await this.findOr404(id);
    this.assertCreatorOrAdmin(actor, tournament);
    if (tournament.status !== 'draft') {
      throw new ConflictException(
        `Fixtures can only be generated from draft (current: ${tournament.status})`,
      );
    }
    const participants = asArray(tournament.participantIds);
    const fixtures: MatchResult[] = [];
    for (let i = 0; i < participants.length; i += 1) {
      for (let j = i + 1; j < participants.length; j += 1) {
        fixtures.push(
          this.matches.create({
            sport: tournament.sport,
            venueId: tournament.venueId ?? null,
            teamA: [participants[i]],
            teamB: [participants[j]],
            scoreA: 0,
            scoreB: 0,
            status: 'pending',
            createdBy: tournament.createdBy,
            confirmedBy: [],
            tournamentId: tournament.id,
          }),
        );
      }
    }
    for (const fixture of fixtures) {
      await this.matches.save(fixture);
    }
    tournament.status = 'ongoing';
    const saved = await this.tournaments.save(tournament);
    return this.toDetail(saved, await this.fixturesOf(saved.id));
  }

  /** GET /tournaments/me — turnamen yang melibatkan user (peserta/creator). */
  async listMine(actor: ActorInput): Promise<{ data: TournamentItem[] }> {
    const rows = await this.tournaments.find({
      order: { createdAt: 'DESC' },
    });
    const data = rows
      .filter(
        (t) =>
          t.createdBy === actor.id ||
          asArray(t.participantIds).includes(actor.id),
      )
      .map((t) => this.toPublic(t));
    return { data };
  }

  /** GET /tournaments/:id — terlibat (peserta/creator) atau super_admin + fixture. */
  async detail(actor: ActorInput, id: string): Promise<TournamentDetail> {
    const tournament = await this.findOr404(id);
    this.assertCanView(actor, tournament);
    return this.toDetail(tournament, await this.fixturesOf(tournament.id));
  }

  /**
   * POST /tournaments/:id/cancel — creator/super_admin, selama belum `done`.
   * Fixture `pending` milik turnamen ikut dibatalkan (`cancelled`) agar tidak
   * yatim; fixture `confirmed`/`disputed` dibiarkan (riwayat ELO utuh).
   */
  async cancel(actor: ActorInput, id: string): Promise<TournamentItem> {
    const tournament = await this.findOr404(id);
    this.assertCreatorOrAdmin(actor, tournament);
    if (tournament.status === 'done') {
      throw new ConflictException('A finished tournament cannot be cancelled');
    }
    if (tournament.status === 'cancelled') {
      throw new ConflictException('Tournament is already cancelled');
    }
    tournament.status = 'cancelled';
    const saved = await this.tournaments.save(tournament);
    const fixtures = await this.fixturesOf(saved.id);
    for (const fixture of fixtures) {
      if (fixture.status === 'pending') {
        fixture.status = 'cancelled';
        await this.matches.save(fixture);
      }
    }
    return this.toPublic(saved);
  }

  // ---- internal ----

  private async findOr404(id: string): Promise<Tournament> {
    const tournament = await this.tournaments.findOne({ where: { id } });
    if (!tournament) throw new NotFoundException('Tournament not found');
    return tournament;
  }

  private assertCreatorOrAdmin(actor: ActorInput, t: Tournament): void {
    if (actor.role === 'super_admin') return;
    if (actor.id === t.createdBy) return;
    throw new ForbiddenException('Only the creator can manage this tournament');
  }

  private assertCanView(actor: ActorInput, t: Tournament): void {
    if (actor.role === 'super_admin') return;
    if (actor.id === t.createdBy) return;
    if (asArray(t.participantIds).includes(actor.id)) return;
    throw new ForbiddenException('You are not part of this tournament');
  }

  private async assertUsersExist(ids: string[]): Promise<void> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return;
    const found = await this.users
      .createQueryBuilder('u')
      .where('u.id IN (:...ids)', { ids: unique })
      .getMany();
    if (found.length !== unique.length) {
      throw new NotFoundException('One or more participants do not exist');
    }
  }

  private async fixturesOf(tournamentId: string): Promise<MatchResult[]> {
    const all = await this.matches.find({ order: { createdAt: 'ASC' } });
    return all.filter((m) => m.tournamentId === tournamentId);
  }

  private toPublic(t: Tournament): TournamentItem {
    return {
      id: t.id,
      name: t.name,
      sport: t.sport,
      venueId: t.venueId ?? null,
      createdBy: t.createdBy,
      participantIds: asArray(t.participantIds),
      status: t.status,
      winnerId: t.winnerId ?? null,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  }

  private toDetail(t: Tournament, fixtures: MatchResult[]): TournamentDetail {
    return {
      ...this.toPublic(t),
      fixtures: fixtures.map(toMatchItem),
    };
  }
}

/** Kolom array bisa null (simple-json sqljs) → normalisasi ke []. */
function asArray(value: string[] | null | undefined): string[] {
  return Array.isArray(value) ? value : [];
}

function toMatchItem(m: MatchResult): MatchItem {
  return {
    id: m.id,
    sport: m.sport,
    venueId: m.venueId ?? null,
    teamA: asArray(m.teamA),
    teamB: asArray(m.teamB),
    scoreA: m.scoreA,
    scoreB: m.scoreB,
    status: m.status,
    createdBy: m.createdBy,
    confirmedBy: asArray(m.confirmedBy),
    tournamentId: m.tournamentId ?? null,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}
