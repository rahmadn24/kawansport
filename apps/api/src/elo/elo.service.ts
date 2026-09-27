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
import { BadgesService } from '../badges/badges.service';
import { Tournament } from '../tournaments/tournament.entity';
import { computeStanding } from '../tournaments/standing';
import { User } from '../users/user.entity';
import { Venue } from '../venues/venue.entity';
import type { CreateMatchDto } from './dto/create-match.dto';
import { EloHistory } from './elo-history.entity';
import { EloRating } from './elo-rating.entity';
import { MatchResult, type MatchStatus } from './match-result.entity';

/** Skor awal pemain yang belum punya baris rating (EL-00). */
export const DEFAULT_ELO_SCORE = 1000;

/** Batas match untuk status provisional (derived: matchesPlayed < 10). */
export const PROVISIONAL_MATCH_LIMIT = 10;

/**
 * Rating decay oportunistik (EL-05, TANPA cron).
 *
 * RUMUS (didokumentasikan + contoh angka):
 * - Jangkar = `lastMatchAt` (diisi tiap match confirmed; null = belum
 *   pernah main → tidak kena decay).
 * - `fullDays = floor((now − lastMatchAt) / 24 jam)`; bila `fullDays ≤ 90`
 *   → tidak decay (masa tenggang 90 hari).
 * - `totalPeriods = floor((fullDays − 90) / 30)` (periode 30-hari PENUH di
 *   atas tenggang); `due = totalPeriods − decayedPeriods`
 *   (`decayedPeriods` = periode yang sudah diterapkan; direset ke 0 tiap
 *   match confirmed baru; `lastMatchAt` TIDAK PERNAH digeser oleh decay —
 *   keputusan EL-05).
 * - Bila `due > 0`: `score = max(800, score − 10 × due)`,
 *   `decayedPeriods = totalPeriods`, + 1 baris history `kind='decay'`
 *   (`matchId` null, `kFactor` 0).
 *
 * CONTOH: skor 1000, vakum 121 hari → `floor((121−90)/30) = 1` periode →
 * 1000 − 10 = 990. Baca berikutnya (masih 121 hari diff) → `due = 1 − 1
 * = 0` → tetap 990 (idempoten, tanpa double-decay). Skor 805, vakum 200
 * hari → `floor(110/30) = 3` → `max(800, 805−30) = 800` (lantai 800).
 */
export const DECAY_GRACE_DAYS = 90;
export const DECAY_PERIOD_DAYS = 30;
export const DECAY_POINTS_PER_PERIOD = 10;
export const DECAY_FLOOR = 800;

/** Total periode decay yang SEHARUSNYA sudah diterapkan (murni dari selisih). */
export function decayPeriodsDue(
  lastMatchAt: Date | string | null | undefined,
  now: Date = new Date(),
): number {
  if (!lastMatchAt) return 0;
  const anchor = new Date(lastMatchAt).getTime();
  if (!Number.isFinite(anchor)) return 0;
  const ms = now.getTime() - anchor;
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  const fullDays = Math.floor(ms / 86_400_000);
  if (fullDays <= DECAY_GRACE_DAYS) return 0;
  return Math.floor((fullDays - DECAY_GRACE_DAYS) / DECAY_PERIOD_DAYS);
}

/** Skor walkover (EL-05): pemenang 21, yang WO 0 (skor bulu tangkis wajar). */
export const WALKOVER_WINNER_SCORE = 21;
export const WALKOVER_LOSER_SCORE = 0;

export interface MatchItem {
  id: string;
  sport: string;
  venueId: string | null;
  teamA: string[];
  teamB: string[];
  scoreA: number;
  scoreB: number;
  status: MatchStatus;
  createdBy: string;
  confirmedBy: string[];
  /** Id turnamen pemilik fixture (EL-03) — null untuk match biasa. */
  tournamentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EloItem {
  sport: string;
  score: number;
  matchesPlayed: number;
  /** Derived: matchesPlayed < 10 (tanpa kolom sendiri). */
  provisional: boolean;
}

/**
 * Satu baris leaderboard venue (EL-02, publik).
 * `displayName` = nama asli apa adanya (leaderboard publik — TIDAK
 * disamarkan, tidak seperti review anonim ST-06); null bila user belum
 * mengisi nama. `elo` = rating cabor filter saat ini, null bila filter
 * sport kosong (agregat lintas cabor) atau pemain belum punya rating.
 */
export interface LeaderboardEntry {
  userId: string;
  displayName: string | null;
  played: number;
  wins: number;
  losses: number;
  elo: number | null;
  /**
   * EL-05: `matchesPlayed < 10` pada cabor filter (derived, sama seperti
   * `EloItem.provisional` dan badge search EL-01). `null` bila `elo` null
   * (tanpa filter sport / belum punya rating — tidak ada rating tunggal
   * yang bisa dinilai provisional).
   */
  provisional: boolean | null;
}

/** Batas default leaderboard venue (EL-02). */
export const DEFAULT_LEADERBOARD_LIMIT = 20;

/**
 * Ekspektasi skor standar ELO: EA = 1 / (1 + 10^((RB - RA) / 400)),
 * dengan RA/RB = rata-rata rating tim.
 */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * K-factor EL-00: provisional (< 10 match) → 48; rating >= 2400 → 24;
 * selain itu 32 (standar).
 */
export function kFactorFor(score: number, matchesPlayed: number): number {
  if (matchesPlayed < PROVISIONAL_MATCH_LIMIT) return 48;
  if (score >= 2400) return 24;
  return 32;
}

@Injectable()
export class EloService {
  constructor(
    @InjectRepository(MatchResult)
    private readonly matches: Repository<MatchResult>,
    @InjectRepository(EloRating)
    private readonly ratings: Repository<EloRating>,
    @InjectRepository(EloHistory)
    private readonly history: Repository<EloHistory>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Venue)
    private readonly venues: Repository<Venue>,
    @InjectRepository(Tournament)
    private readonly tournaments: Repository<Tournament>,
    private readonly badges: BadgesService,
  ) {}

  /** POST /matches — catat hasil (status awal `pending`). */
  async create(actor: ActorInput, dto: CreateMatchDto): Promise<MatchItem> {
    const sport = dto.sport.trim();
    if (!sport) throw new BadRequestException('Sport must not be empty');
    const teamA = dedupe(dto.teamA);
    const teamB = dedupe(dto.teamB);
    assertValidTeams(teamA, teamB);
    await this.assertUsersExist([...teamA, ...teamB]);
    if (dto.venueId) {
      const venue = await this.venues.findOne({ where: { id: dto.venueId } });
      if (!venue) throw new NotFoundException('Venue not found');
    }
    // Creator otomatis confirmer pihak timnya bila ia termasuk salah satu tim.
    const confirmedBy =
      teamA.includes(actor.id) || teamB.includes(actor.id) ? [actor.id] : [];
    const match = this.matches.create({
      sport,
      venueId: dto.venueId ?? null,
      teamA,
      teamB,
      scoreA: dto.scoreA,
      scoreB: dto.scoreB,
      status: 'pending',
      createdBy: actor.id,
      confirmedBy,
      tournamentId: null,
    });
    return this.toPublic(await this.matches.save(match));
  }

  /** GET /matches/me — semua match yang melibatkan user (?status?). */
  async listMine(
    actor: ActorInput,
    status?: MatchStatus,
  ): Promise<{ data: MatchItem[] }> {
    // Filter array di memori agar portabel postgres (text[]) maupun
    // sqljs-test (simple-json) tanpa operator array spesifik driver.
    const rows = await this.matches.find({ order: { createdAt: 'DESC' } });
    const data = rows
      .filter(
        (m) =>
          asArray(m.teamA).includes(actor.id) ||
          asArray(m.teamB).includes(actor.id),
      )
      .filter((m) => !status || m.status === status)
      .map((m) => this.toPublic(m));
    return { data };
  }

  /** GET /matches/:id — terlibat atau super_admin, selain itu 403 (tak ada → 404). */
  async detail(actor: ActorInput, id: string): Promise<MatchItem> {
    const match = await this.findOr404(id);
    this.assertCanView(actor, match);
    return this.toPublic(match);
  }

  /**
   * POST /matches/:id/confirm — konfirmasi dua pihak.
   * Hanya user yang termasuk teamA ATAU teamB (selain itu 403). Confirmer
   * dicatat; bila sudah ada confirmer dari KEDUA tim → status `confirmed`
   * + ELO diterapkan SEKALI (confirm ulang → 200 tanpa efek ganda).
   * Satu pihak saja → tetap `pending`, rating tak berubah.
   */
  async confirm(actor: ActorInput, id: string): Promise<MatchItem> {
    const match = await this.findOr404(id);
    const teamA = asArray(match.teamA);
    const teamB = asArray(match.teamB);
    const side = sideOf(actor.id, teamA, teamB);
    if (!side) {
      throw new ForbiddenException('Only players of this match can confirm');
    }
    if (match.status === 'confirmed') return this.toPublic(match);
    if (match.status !== 'pending') {
      throw new ConflictException(
        `Cannot confirm a ${match.status} match`,
      );
    }
    const confirmedBy = asArray(match.confirmedBy);
    if (!confirmedBy.includes(actor.id)) {
      confirmedBy.push(actor.id);
      match.confirmedBy = confirmedBy;
    }
    if (hasBothSides(confirmedBy, teamA, teamB)) {
      await this.applyElo(match);
      match.status = 'confirmed';
      const saved = await this.matches.save(match);
      await this.maybeFinishTournament(saved);
      return this.toPublic(saved);
    }
    return this.toPublic(await this.matches.save(match));
  }

  /**
   * POST /matches/:id/score (EL-03) — koreksi skor fixture turnamen yang
   * masih `pending`. Hanya pemain match tsb atau super_admin (else 403);
   * non-`pending` (confirmed/disputed/cancelled) → 409.
   * `confirmedBy` di-reset ke [] karena hasil berubah — kedua pihak wajib
   * konfirmasi ulang via POST /matches/:id/confirm (ELO + history ikut
   * alur EL-00 yang sudah ada).
   */
  async setScore(
    actor: ActorInput,
    id: string,
    scoreA: number,
    scoreB: number,
  ): Promise<MatchItem> {
    const match = await this.findOr404(id);
    if (match.status !== 'pending') {
      throw new ConflictException(
        `Only pending matches can be re-scored (current: ${match.status})`,
      );
    }
    if (
      actor.role !== 'super_admin' &&
      !sideOf(actor.id, asArray(match.teamA), asArray(match.teamB))
    ) {
      throw new ForbiddenException('Only players of this match can set score');
    }
    match.scoreA = scoreA;
    match.scoreB = scoreB;
    match.confirmedBy = [];
    return this.toPublic(await this.matches.save(match));
  }

  /** POST /matches/:id/cancel — creator/super_admin, hanya bila `pending`. */
  async cancel(actor: ActorInput, id: string): Promise<MatchItem> {
    const match = await this.findOr404(id);
    if (actor.role !== 'super_admin' && actor.id !== match.createdBy) {
      throw new ForbiddenException('Only the creator can cancel this match');
    }
    if (match.status !== 'pending') {
      throw new ConflictException(
        `Only pending matches can be cancelled (current: ${match.status})`,
      );
    }
    match.status = 'cancelled';
    return this.toPublic(await this.matches.save(match));
  }

  /**
   * POST /matches/:id/dispute — user terlibat → status `disputed` + freeze
   * (rating yang sudah terlanjur diterapkan TIDAK di-rollback).
   *
   * EL-05: jalur dispute-center (`POST /disputes` dengan `targetType:
   * 'match'`) otomatis menandai match `disputed` juga; admin menutup alur
   * via `POST /matches/:id/resolve-dispute` (`confirm` → ELO jalan bila
   * skor valid / `cancel` → batal) + resolve tiket center seperti biasa.
   */
  async dispute(actor: ActorInput, id: string): Promise<MatchItem> {
    const match = await this.findOr404(id);
    if (!sideOf(actor.id, asArray(match.teamA), asArray(match.teamB))) {
      throw new ForbiddenException('Only players of this match can dispute');
    }
    if (match.status !== 'pending' && match.status !== 'confirmed') {
      throw new ConflictException(
        `Cannot dispute a ${match.status} match`,
      );
    }
    match.status = 'disputed';
    return this.toPublic(await this.matches.save(match));
  }

  /**
   * POST /matches/:id/resolve-dispute (EL-05, khusus super_admin — guard
   * di controller). Menutup match `disputed` hasil sengketa:
   * - `confirm` → `confirmed` + ELO diterapkan normal (decay pre-pass
   *   dulu; skor dianggap valid apa adanya — admin yang menilai).
   * - `cancel` → `cancelled` (walkover/batal; rating tak tersentuh).
   * Non-`disputed` → 409. Dispute-center record ditutup TERPISAH via
   * `POST /disputes/:id/resolve` (kontrak dispute tidak diubah — dua
   * langkah yang didokumentasikan, bukan satu aksi implisit).
   */
  async resolveDisputed(
    id: string,
    decision: 'confirm' | 'cancel',
  ): Promise<MatchItem> {
    const match = await this.findOr404(id);
    if (match.status !== 'disputed') {
      throw new ConflictException(
        `Only disputed matches can be resolved (current: ${match.status})`,
      );
    }
    if (decision === 'cancel') {
      match.status = 'cancelled';
      return this.toPublic(await this.matches.save(match));
    }
    await this.applyElo(match);
    match.status = 'confirmed';
    const saved = await this.matches.save(match);
    await this.maybeFinishTournament(saved);
    return this.toPublic(saved);
  }

  /**
   * POST /matches/:id/walkover (EL-05, khusus super_admin — guard di
   * controller). KEPUTUSAN: hanya super_admin (bukan kesepakatan pemain)
   * agar hasil WO tidak bisa dipaksakan satu pihak ke pihak lain.
   * Dari `pending`/`disputed` → skor WO (pemenang 21, WO 0), `confirmed`,
   * ELO jalan normal (termasuk decay pre-pass + `maybeFinishTournament`
   * sehingga fixture WO tidak memblokir juara otomatis EL-04).
   * `confirmed`/`cancelled` → 409.
   */
  async walkover(
    id: string,
    winnerSide: 'A' | 'B',
  ): Promise<MatchItem> {
    const match = await this.findOr404(id);
    if (match.status !== 'pending' && match.status !== 'disputed') {
      throw new ConflictException(
        `Only pending/disputed matches can be walkovered (current: ${match.status})`,
      );
    }
    if (winnerSide === 'A') {
      match.scoreA = WALKOVER_WINNER_SCORE;
      match.scoreB = WALKOVER_LOSER_SCORE;
    } else {
      match.scoreA = WALKOVER_LOSER_SCORE;
      match.scoreB = WALKOVER_WINNER_SCORE;
    }
    await this.applyElo(match);
    match.status = 'confirmed';
    const saved = await this.matches.save(match);
    await this.maybeFinishTournament(saved);
    return this.toPublic(saved);
  }

  /** GET /elo/me — semua rating cabor milik sendiri (decay oportunistik dulu). */
  async myElo(actor: ActorInput): Promise<{ data: EloItem[] }> {
    return this.userElo(actor.id);
  }

  /**
   * GET /users/:id/elo — publik (tanpa auth). Tak ada user → 404.
   * EL-05: decay oportunistik diterapkan + dipersist (+ history
   * `kind='decay'`) SEBELUM respons dibaca — tanpa cron.
   */
  async userElo(userId: string): Promise<{ data: EloItem[] }> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const rows = await this.ratings.find({
      where: { userId },
      order: { sport: 'ASC' },
    });
    const now = new Date();
    for (const row of rows) {
      await this.applyDecayDue(row, now);
    }
    return { data: rows.map(toEloItem) };
  }

  /**
   * GET /venues/:id/leaderboard — publik (tanpa auth). Venue tak ada → 404.
   * Agregasi read-only dari `MatchResult` `confirmed` pada venue (+ sport
   * bila diisi, case-insensitive): per pemain { played, wins, losses }
   * (seri = played saja, tanpa win/loss) + `elo` = rating cabor filter
   * saat ini (null bila tanpa filter sport atau belum punya rating) +
   * `provisional` (EL-05, null bila `elo` null).
   * EL-05: decay oportunistik diterapkan + dipersist untuk rating cabor
   * filter yang ditampilkan — tanpa cron.
   * Urut: wins DESC, elo DESC (null terbawah), displayName ASC (stabil).
   */
  async venueLeaderboard(
    venueId: string,
    sport?: string,
    limit?: number,
  ): Promise<{
    data: LeaderboardEntry[];
    meta: { venueId: string; sport: string | null; total: number };
  }> {
    const venue = await this.venues.findOne({ where: { id: venueId } });
    if (!venue) throw new NotFoundException('Venue not found');
    const filteredSport = sport?.trim() ? sport.trim() : null;
    const take = Math.min(
      Math.max(limit ?? DEFAULT_LEADERBOARD_LIMIT, 1),
      100,
    );

    // Filter di memori agar portabel postgres maupun sqljs-test
    // (pola yang sama dengan `listMine`).
    const all = await this.matches.find();
    const rows = all.filter(
      (m) =>
        m.status === 'confirmed' &&
        m.venueId === venueId &&
        (!filteredSport ||
          m.sport.toLowerCase() === filteredSport.toLowerCase()),
    );

    const agg = new Map<string, { played: number; wins: number; losses: number }>();
    const touch = (id: string) => {
      let row = agg.get(id);
      if (!row) {
        row = { played: 0, wins: 0, losses: 0 };
        agg.set(id, row);
      }
      return row;
    };
    for (const m of rows) {
      const teamA = asArray(m.teamA);
      const teamB = asArray(m.teamB);
      const wonA = m.scoreA > m.scoreB;
      const wonB = m.scoreB > m.scoreA;
      for (const id of teamA) {
        const row = touch(id);
        row.played += 1;
        if (wonA) row.wins += 1;
        else if (wonB) row.losses += 1;
      }
      for (const id of teamB) {
        const row = touch(id);
        row.played += 1;
        if (wonB) row.wins += 1;
        else if (wonA) row.losses += 1;
      }
    }

    const ids = [...agg.keys()];
    const names = new Map<string, string | null>();
    const elos = new Map<string, number>();
    const provs = new Map<string, boolean>();
    if (ids.length > 0) {
      const foundUsers = await this.users
        .createQueryBuilder('u')
        .where('u.id IN (:...ids)', { ids })
        .getMany();
      for (const u of foundUsers) names.set(u.id, u.displayName ?? null);
      if (filteredSport) {
        const foundRatings = await this.ratings
          .createQueryBuilder('r')
          .where('r.userId IN (:...ids)', { ids })
          .getMany();
        const want = filteredSport.toLowerCase();
        const now = new Date();
        for (const r of foundRatings) {
          if (r.sport.toLowerCase() === want && !elos.has(r.userId)) {
            await this.applyDecayDue(r, now);
            elos.set(r.userId, r.score);
            provs.set(r.userId, r.matchesPlayed < PROVISIONAL_MATCH_LIMIT);
          }
        }
      }
    }

    const data: LeaderboardEntry[] = ids.map((userId) => {
      const row = agg.get(userId)!;
      const elo = elos.get(userId) ?? null;
      return {
        userId,
        displayName: names.get(userId) ?? null,
        played: row.played,
        wins: row.wins,
        losses: row.losses,
        elo,
        provisional: elo == null ? null : (provs.get(userId) ?? true),
      };
    });
    data.sort(
      (a, b) =>
        b.wins - a.wins ||
        (b.elo ?? Number.NEGATIVE_INFINITY) -
          (a.elo ?? Number.NEGATIVE_INFINITY) ||
        (a.displayName ?? '').localeCompare(b.displayName ?? '') ||
        a.userId.localeCompare(b.userId),
    );
    return {
      data: data.slice(0, take),
      meta: { venueId, sport: filteredSport, total: data.length },
    };
  }

  // ---- internal ----

  /**
   * Juara otomatis (EL-04): dipanggil tiap kali sebuah fixture turnamen
   * menjadi `confirmed` (satu-satunya path confirm/score EL-00/03).
   * Bila SEMUA fixture turnamen `confirmed` (tanpa pending/disputed/
   * cancelled) dan turnamen masih `ongoing` → status `done` + `winnerId`
   * = peringkat 1 standing + badge `tournament_champion` otomatis.
   * Idempotent: turnamen yang sudah `done`/`cancelled` dilewati; badge
   * memakai guard duplikat (unique user+kind+refId).
   * Fixture `disputed`/`cancelled` MEMBLOKIR auto-done (walkover = EL-05).
   */
  private async maybeFinishTournament(match: MatchResult): Promise<void> {
    if (!match.tournamentId) return;
    const tournament = await this.tournaments.findOne({
      where: { id: match.tournamentId },
    });
    if (!tournament || tournament.status !== 'ongoing') return;
    const all = await this.matches.find({ order: { createdAt: 'ASC' } });
    const fixtures = all.filter((m) => m.tournamentId === tournament.id);
    if (fixtures.length === 0) return;
    if (fixtures.some((f) => f.status !== 'confirmed')) return;
    const participantIds = asArray(tournament.participantIds);
    const names = new Map<string, string | null>();
    if (participantIds.length > 0) {
      const found = await this.users
        .createQueryBuilder('u')
        .where('u.id IN (:...ids)', { ids: participantIds })
        .getMany();
      for (const u of found) names.set(u.id, u.displayName ?? null);
    }
    const standings = computeStanding(participantIds, names, fixtures);
    const champion = standings[0];
    if (!champion) return;
    tournament.status = 'done';
    tournament.winnerId = champion.userId;
    await this.tournaments.save(tournament);
    await this.badges.award(
      champion.userId,
      'tournament_champion',
      tournament.id,
    );
  }

  private async findOr404(id: string): Promise<MatchResult> {
    const match = await this.matches.findOne({ where: { id } });
    if (!match) throw new NotFoundException('Match not found');
    return match;
  }

  private assertCanView(actor: ActorInput, match: MatchResult): void {
    if (actor.role === 'super_admin') return;
    if (
      sideOf(actor.id, asArray(match.teamA), asArray(match.teamB))
    ) {
      return;
    }
    throw new ForbiddenException('You are not part of this match');
  }

  private async assertUsersExist(ids: string[]): Promise<void> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return;
    const found = await this.users
      .createQueryBuilder('u')
      .where('u.id IN (:...ids)', { ids: unique })
      .getMany();
    if (found.length !== unique.length) {
      throw new NotFoundException('One or more players do not exist');
    }
  }

  /**
   * Terapkan ELO standar untuk match yang baru confirmed. EL-05: decay
   * yang jatuh tempo diterapkan DULU per pemain (persist + history decay),
   * lalu delta match dihitung dari skor efektif. Tiap pemain dihitung vs
   * rata-rata rating tim lawan; delta integer (round); history match
   * ditulis per pemain; `lastMatchAt = now` + `decayedPeriods = 0`.
   * Dipanggil sekali per match (guard status di `confirm`/`walkover`/
   * `resolveDisputed`); idempotent karena hanya dari transisi ke confirmed.
   */
  private async applyElo(match: MatchResult): Promise<void> {
    const teamA = asArray(match.teamA);
    const teamB = asArray(match.teamB);
    const all = [...teamA, ...teamB];
    const now = new Date();
    const current = new Map<string, EloRating>();
    for (const userId of all) {
      const rating = await this.getOrCreate(match.sport, userId);
      await this.applyDecayDue(rating, now);
      current.set(userId, rating);
    }
    const avg = (ids: string[]): number =>
      ids.reduce((sum, id) => sum + (current.get(id)?.score ?? DEFAULT_ELO_SCORE), 0) /
      ids.length;
    const avgA = avg(teamA);
    const avgB = avg(teamB);
    const { scoreA, scoreB } = match;
    const actualA = scoreA > scoreB ? 1 : scoreA < scoreB ? 0 : 0.5;
    const actualB = 1 - actualA;

    const updates: EloRating[] = [];
    const rows: EloHistory[] = [];
    for (const userId of all) {
      const rating = current.get(userId)!;
      const inA = teamA.includes(userId);
      const expected = inA
        ? expectedScore(rating.score, avgB)
        : expectedScore(rating.score, avgA);
      const actual = inA ? actualA : actualB;
      const k = kFactorFor(rating.score, rating.matchesPlayed);
      const delta = Math.round(k * (actual - expected));
      const before = rating.score;
      rating.score = before + delta;
      rating.matchesPlayed += 1;
      rating.lastMatchAt = now;
      rating.decayedPeriods = 0;
      updates.push(rating);
      rows.push(
        this.history.create({
          userId,
          sport: match.sport,
          kind: 'match',
          matchId: match.id,
          before,
          after: rating.score,
          delta,
          kFactor: k,
        }),
      );
    }
    for (const rating of updates) {
      await this.ratings.save(rating);
    }
    for (const row of rows) {
      await this.history.save(row);
    }
  }

  private async getOrCreate(sport: string, userId: string): Promise<EloRating> {
    const existing = await this.ratings.findOne({ where: { userId, sport } });
    if (existing) return existing;
    return this.ratings.create({
      userId,
      sport,
      score: DEFAULT_ELO_SCORE,
      matchesPlayed: 0,
      lastMatchAt: null,
      decayedPeriods: 0,
    });
  }

  /**
   * Decay oportunistik satu baris rating (EL-05). Idempoten via
   * `decayedPeriods` (tanpa menggeser `lastMatchAt`): hanya periode BARU
   * yang dikurangkan. Persist + 1 baris history `kind='decay'`
   * (`matchId` null, `kFactor` 0). Return true bila ada yang diterapkan.
   */
  private async applyDecayDue(
    rating: EloRating,
    now: Date,
  ): Promise<boolean> {
    const total = decayPeriodsDue(rating.lastMatchAt ?? null, now);
    const due = total - (rating.decayedPeriods ?? 0);
    if (due <= 0) return false;
    const before = rating.score;
    const after = Math.max(
      DECAY_FLOOR,
      before - DECAY_POINTS_PER_PERIOD * due,
    );
    rating.score = after;
    rating.decayedPeriods = total;
    await this.ratings.save(rating);
    await this.history.save(
      this.history.create({
        userId: rating.userId,
        sport: rating.sport,
        kind: 'decay',
        matchId: null,
        before,
        after,
        delta: after - before,
        kFactor: 0,
      }),
    );
    return true;
  }

  private toPublic(m: MatchResult): MatchItem {
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
}

function toEloItem(r: EloRating): EloItem {
  return {
    sport: r.sport,
    score: r.score,
    matchesPlayed: r.matchesPlayed,
    provisional: r.matchesPlayed < PROVISIONAL_MATCH_LIMIT,
  };
}

/** Kolom array bisa null (simple-json sqljs) → normalisasi ke []. */
function asArray(value: string[] | null | undefined): string[] {
  return Array.isArray(value) ? value : [];
}

function dedupe(ids: string[]): string[] {
  return [...new Set(ids)];
}

/** Validasi tim: min 1v1 (di-DTO) + tak boleh overlap + tanpa duplikat dalam tim. */
function assertValidTeams(teamA: string[], teamB: string[]): void {
  if (teamA.length !== dedupe(teamA).length || teamB.length !== dedupe(teamB).length) {
    throw new BadRequestException('Duplicate player inside a team');
  }
  const overlap = teamA.filter((id) => teamB.includes(id));
  if (overlap.length > 0) {
    throw new BadRequestException('teamA and teamB must not overlap');
  }
}

/** 'A' | 'B' bila user termasuk tim tsb, else null. */
function sideOf(
  userId: string,
  teamA: string[],
  teamB: string[],
): 'A' | 'B' | null {
  if (teamA.includes(userId)) return 'A';
  if (teamB.includes(userId)) return 'B';
  return null;
}

/** true bila confirmer mencakup >= 1 anggota teamA DAN >= 1 anggota teamB. */
function hasBothSides(
  confirmedBy: string[],
  teamA: string[],
  teamB: string[],
): boolean {
  return (
    teamA.some((id) => confirmedBy.includes(id)) &&
    teamB.some((id) => confirmedBy.includes(id))
  );
}
