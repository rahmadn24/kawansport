import React from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import type { AppNotification } from '../api/notifications';
import { COLORS, SPACING, TYPO, formatWIB, friendlyServerError } from '../theme';
import {
  UIAppBar,
  UIBadge,
  UIButton,
  UIEmptyState,
  UIErrorBanner,
  UISkeleton,
} from '../components/ui';

interface Props {
  notifications: AppNotification[];
  total: number;
  loading: boolean;
  error: string | null;
  /** Id notifikasi yang sedang ditandai dibaca (spinner per baris). */
  markingId: string | null;
  markError: string | null;
  onRefresh: () => void;
  onMarkRead: (id: string) => void;
  onBack: () => void;
}

/**
 * Kotak masuk notifikasi (GAP-01): daftar riwayat + tandai dibaca.
 * Kosong = empty jujur (bukan daftar palsu).
 */
export function NotifInboxScreen({
  notifications,
  total,
  loading,
  error,
  markingId,
  markError,
  onRefresh,
  onMarkRead,
  onBack,
}: Props) {
  const firstLoad = loading && notifications.length === 0;
  return (
    <View style={styles.screen}>
      <View style={styles.padded}>
        <UIAppBar title="Notifikasi" onBack={onBack} />
      </View>
      {firstLoad ? (
        <View style={styles.padded}>
          <UISkeleton rows={4} />
        </View>
      ) : (
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={notifications}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}
          ListHeaderComponent={
            <View>
              <UIErrorBanner
                message={friendlyServerError(error)}
                actionLabel="Coba lagi"
                onAction={onRefresh}
              />
              <UIErrorBanner message={friendlyServerError(markError)} />
              <Text style={styles.meta} accessibilityRole="text">
                {total > 0 ? `${total} notifikasi` : null}
              </Text>
            </View>
          }
          ListEmptyComponent={
            loading ? null : (
              <UIEmptyState
                illustration="🔔"
                title="Belum ada notifikasi"
                message="Info mabar, booking, dan update penting akan muncul di sini."
                actionLabel="Muat ulang"
                onAction={onRefresh}
                actionA11y="Muat ulang notifikasi"
              />
            )
          }
          renderItem={({ item }) => {
            const unread = !item.readAt;
            const marking = markingId === item.id;
            return (
              <View
                style={[styles.card, unread && styles.cardUnread]}
                accessibilityLabel={`Notifikasi: ${item.title}${unread ? ', belum dibaca' : ''}`}
              >
                <View style={styles.topRow}>
                  <Text style={styles.title} numberOfLines={2}>
                    {item.title}
                  </Text>
                  {unread ? <UIBadge kind="unread" label="Baru" /> : null}
                </View>
                {item.body ? (
                  <Text style={styles.body} numberOfLines={3}>
                    {item.body}
                  </Text>
                ) : null}
                <Text style={styles.stamp}>{formatWIB(item.createdAt)}</Text>
                {unread ? (
                  <View style={styles.action}>
                    <UIButton
                      title={marking ? 'Menandai…' : 'Tandai dibaca'}
                      variant="outline"
                      onPress={() => onMarkRead(item.id)}
                      disabled={marking}
                      accessibilityLabel={`Tandai dibaca: ${item.title}`}
                    />
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
  meta: { fontSize: 13, color: COLORS.muted, marginBottom: SPACING.sm, textAlign: 'center' },
  card: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  cardUnread: { borderColor: COLORS.brand700, borderWidth: 1.5 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  title: { ...TYPO.cardTitle, color: COLORS.ink, flex: 1, marginRight: SPACING.sm },
  body: { fontSize: 14, color: COLORS.muted, lineHeight: 20, marginTop: 4 },
  stamp: { fontSize: 12, color: COLORS.faint, marginTop: 6 },
  action: { marginTop: SPACING.sm },
});
