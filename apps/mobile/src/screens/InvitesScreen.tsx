import React from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import type { InviteDir, InviteItem } from '../api/invites';
import { inviteStatusLabel } from '../api/invites';
import { COLORS, RADIUS, SPACING, TYPO, formatWIB, friendlyServerError } from '../theme';
import {
  UIAppBar,
  UIBadge,
  UIButton,
  UIEmptyState,
  UIErrorBanner,
  UISegmented,
  UISkeleton,
} from '../components/ui';

interface Props {
  incoming: InviteItem[];
  outgoing: InviteItem[];
  dir: InviteDir;
  onDirChange: (dir: InviteDir) => void;
  loading: boolean;
  error: string | null;
  /** Id invite yang sedang diproses terima/tolak (spinner per baris). */
  actionId: string | null;
  actionError: string | null;
  onRefresh: () => void;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  onBack: () => void;
}

function badgeKindOf(status: InviteItem['status']): 'pending' | 'paid' | 'cancelled' | 'expired' {
  if (status === 'pending') return 'pending';
  if (status === 'accepted') return 'paid';
  if (status === 'declined') return 'cancelled';
  return 'expired';
}

/**
 * Layar Undangan sparing (GAP-01): masuk/keluar + terima/tolak.
 * Kosong = empty jujur per arah (bukan data palsu).
 */
export function InvitesScreen({
  incoming,
  outgoing,
  dir,
  onDirChange,
  loading,
  error,
  actionId,
  actionError,
  onRefresh,
  onAccept,
  onDecline,
  onBack,
}: Props) {
  const shown = dir === 'in' ? incoming : outgoing;
  const firstLoad = loading && incoming.length === 0 && outgoing.length === 0;
  return (
    <View style={styles.screen}>
      <View style={styles.padded}>
        <UIAppBar title="Undangan Sparing" onBack={onBack} />
        <UISegmented<InviteDir>
          label="Arah undangan"
          value={dir}
          onChange={(v) => {
            if (v) onDirChange(v);
          }}
          options={[
            { value: 'in', label: `Masuk (${incoming.length})` },
            { value: 'sent', label: `Keluar (${outgoing.length})` },
          ]}
        />
      </View>
      {firstLoad ? (
        <View style={styles.padded}>
          <UISkeleton rows={3} />
        </View>
      ) : (
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={shown}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}
          ListHeaderComponent={
            <View>
              <UIErrorBanner
                message={friendlyServerError(error)}
                actionLabel="Coba lagi"
                onAction={onRefresh}
              />
              <UIErrorBanner message={friendlyServerError(actionError)} />
            </View>
          }
          ListEmptyComponent={
            loading ? null : (
              <UIEmptyState
                illustration="📩"
                title={dir === 'in' ? 'Belum ada undangan masuk' : 'Belum ada undangan keluar'}
                message={
                  dir === 'in'
                    ? 'Undangan sparing dari kawan akan muncul di sini.'
                    : 'Cari partner lalu tekan Ajak Main untuk mengundang.'
                }
                actionLabel="Muat ulang"
                onAction={onRefresh}
                actionA11y="Muat ulang undangan"
              />
            )
          }
          renderItem={({ item }) => {
            const busy = actionId === item.id;
            const pending = item.status === 'pending';
            return (
              <View
                style={styles.card}
                accessibilityLabel={`Undangan ${item.sport ?? 'sparing'}: ${inviteStatusLabel(item.status)}`}
              >
                <View style={styles.topRow}>
                  <Text style={styles.title} numberOfLines={1}>
                    {item.sport ? `🏅 ${item.sport}` : '🤝 Ajakan sparing'}
                  </Text>
                  <UIBadge kind={badgeKindOf(item.status)} label={inviteStatusLabel(item.status)} />
                </View>
                {item.message ? (
                  <Text style={styles.msg} numberOfLines={3}>
                    “{item.message}”
                  </Text>
                ) : null}
                <Text style={styles.stamp}>{formatWIB(item.createdAt)}</Text>
                {dir === 'in' && pending ? (
                  <View style={styles.row}>
                    <View style={styles.flex}>
                      <UIButton
                        title={busy ? 'Memproses…' : 'Terima'}
                        onPress={() => onAccept(item.id)}
                        disabled={busy}
                        accessibilityLabel={`Terima undangan ${item.sport ?? 'sparing'}`}
                      />
                    </View>
                    <View style={styles.gapH} />
                    <View style={styles.flex}>
                      <UIButton
                        title="Tolak"
                        variant="outline"
                        onPress={() => onDecline(item.id)}
                        disabled={busy}
                        accessibilityLabel={`Tolak undangan ${item.sport ?? 'sparing'}`}
                      />
                    </View>
                  </View>
                ) : null}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bgAlt },
  padded: { paddingHorizontal: SPACING.screen, paddingTop: SPACING.screen },
  list: { flex: 1 },
  listContent: { paddingHorizontal: SPACING.screen, paddingBottom: SPACING.screen },
  card: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...TYPO.cardTitle, color: COLORS.ink, flex: 1, marginRight: SPACING.sm },
  msg: { fontSize: 14, color: COLORS.muted, lineHeight: 20, marginTop: 4 },
  stamp: { fontSize: 12, color: COLORS.faint, marginTop: 6 },
  row: { flexDirection: 'row', marginTop: SPACING.md },
  flex: { flex: 1 },
  gapH: { width: SPACING.sm },
});
