import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import {
  LeaderboardEntry,
  getVenueLeaderboard,
  leaderboardDisplayName,
  leaderboardRecordLabel,
} from '../api/venues';
import { COLORS, RADIUS, SPACING } from '../theme';
import { UISectionTitle } from './ui';

interface Props {
  /** Id venue yang papan peringkatnya ditampilkan. */
  venueId: string;
  /** Cabor filter (default: cabor pertama venue / court terpilih). */
  sport?: string | null;
  /** Baris teratas yang ditampilkan (default 5). */
  limit?: number;
}

/**
 * Seksi leaderboard venue (EL-02): top-N publik per venue + cabor.
 * Empty jujur ("Belum ada pertandingan ...") bila venue belum punya
 * match confirmed; error fetch ditampilkan apa adanya.
 */
export function VenueLeaderboard({ venueId, sport, limit = 5 }: Props) {
  const [rows, setRows] = useState<LeaderboardEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getVenueLeaderboard(
          venueId,
          sport ? { sport, limit } : { limit },
        );
        if (cancelled) return;
        setRows(res.data);
        setTotal(res.meta.total);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Gagal memuat leaderboard');
        setRows([]);
        setTotal(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [venueId, sport, limit]);

  const subtitle = sport
    ? `Cabor ${sport} • ${total} pemain`
    : `${total} pemain`;

  return (
    <View>
      <UISectionTitle>Papan Peringkat</UISectionTitle>
      <Text style={styles.sub} accessibilityLabel={`Leaderboard ${subtitle}`}>
        {subtitle}
      </Text>
      {loading ? (
        <ActivityIndicator accessibilityLabel="Memuat papan peringkat" />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : rows.length === 0 ? (
        <Text style={styles.empty}>
          Belum ada pertandingan tercatat di venue ini
          {sport ? ` untuk cabor ${sport}` : ''}.
        </Text>
      ) : (
        rows.map((row, i) => (
          <View
            key={row.userId}
            style={styles.row}
            accessibilityLabel={`Peringkat ${i + 1}: ${leaderboardDisplayName(row)}, ${leaderboardRecordLabel(row)}${row.elo != null ? `, ELO ${row.elo}` : ''}`}
          >
            <Text style={styles.rank}>{i + 1}</Text>
            <View style={styles.info}>
              <Text style={styles.name}>{leaderboardDisplayName(row)}</Text>
              <Text style={styles.record}>{leaderboardRecordLabel(row)}</Text>
            </View>
            <Text style={styles.elo}>
              {row.elo != null ? `ELO ${row.elo}` : '—'}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sub: { fontSize: 12, color: COLORS.muted, marginBottom: SPACING.sm },
  empty: {
    fontSize: 14,
    color: COLORS.faint,
    textAlign: 'center',
    paddingVertical: SPACING.lg,
  },
  error: { color: COLORS.danger, marginTop: SPACING.sm, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.bg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    marginTop: SPACING.sm,
  },
  rank: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.brand700,
    minWidth: 28,
    textAlign: 'center',
  },
  info: { flex: 1, marginHorizontal: SPACING.sm },
  name: { fontSize: 14, fontWeight: '700', color: COLORS.ink },
  record: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  elo: { fontSize: 13, fontWeight: '800', color: COLORS.brand700 },
});
