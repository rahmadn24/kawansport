import type { MatchStatus } from '../elo/match-result.entity';

export interface StandingFixture {
  teamA: string[];
  teamB: string[];
  scoreA: number;
  scoreB: number;
  status: MatchStatus;
}

export interface StandingEntry {
  userId: string;
  displayName: string | null;
  played: number;
  wins: number;
  losses: number;
  draws: number;
  /** Menang = 3, seri = 1, kalah = 0. */
  points: number;
  /** Selisih skor total (skor dicetak − skor kebobolan). */
  scoreDiff: number;
}

/**
 * Klasemen real-time turnamen (EL-04, murni — tanpa I/O).
 * Hanya fixture `confirmed` yang dihitung; `pending`/`disputed`/
 * `cancelled` dikecualikan (mereka juga memblokir auto-done).
 * Seri = skor sama (kedua pihak +1 poin, tanpa win/loss).
 * Urut: points DESC → wins DESC → scoreDiff DESC → displayName ASC
 * (null terbawah) → userId ASC (stabil).
 */
export function computeStanding(
  participantIds: string[],
  displayNames: Map<string, string | null>,
  fixtures: StandingFixture[],
): StandingEntry[] {
  const rows = new Map<string, StandingEntry>();
  for (const id of participantIds) {
    rows.set(id, {
      userId: id,
      displayName: displayNames.get(id) ?? null,
      played: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      points: 0,
      scoreDiff: 0,
    });
  }
  const touch = (id: string): StandingEntry => {
    let row = rows.get(id);
    if (!row) {
      row = {
        userId: id,
        displayName: displayNames.get(id) ?? null,
        played: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        points: 0,
        scoreDiff: 0,
      };
      rows.set(id, row);
    }
    return row;
  };
  const asArray = (v: string[] | null | undefined): string[] =>
    Array.isArray(v) ? v : [];
  for (const m of fixtures) {
    if (m.status !== 'confirmed') continue;
    const teamA = asArray(m.teamA);
    const teamB = asArray(m.teamB);
    const wonA = m.scoreA > m.scoreB;
    const wonB = m.scoreB > m.scoreA;
    const draw = m.scoreA === m.scoreB;
    for (const id of teamA) {
      const row = touch(id);
      row.played += 1;
      row.scoreDiff += m.scoreA - m.scoreB;
      if (wonA) {
        row.wins += 1;
        row.points += 3;
      } else if (draw) {
        row.draws += 1;
        row.points += 1;
      } else {
        row.losses += 1;
      }
    }
    for (const id of teamB) {
      const row = touch(id);
      row.played += 1;
      row.scoreDiff += m.scoreB - m.scoreA;
      if (wonB) {
        row.wins += 1;
        row.points += 3;
      } else if (draw) {
        row.draws += 1;
        row.points += 1;
      } else {
        row.losses += 1;
      }
    }
  }
  const data = [...rows.values()];
  data.sort(
    (a, b) =>
      b.points - a.points ||
      b.wins - a.wins ||
      b.scoreDiff - a.scoreDiff ||
      (a.displayName ?? '\uffff').localeCompare(b.displayName ?? '\uffff') ||
      a.userId.localeCompare(b.userId),
  );
  return data;
}
