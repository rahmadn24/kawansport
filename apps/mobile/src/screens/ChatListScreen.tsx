import React from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ConversationItem } from '../api/chat';
import { COLORS, RADIUS, SPACING, TYPO, friendlyServerError } from '../theme';
import { UIAvatar, UIBadge, UIEmptyState, UIErrorBanner, UIHeader, UISkeleton } from '../components/ui';
import { formatRelativeTime } from '../mocks/stitch';

interface Props {
  conversations: ConversationItem[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onSelect: (conv: ConversationItem) => void;
}

/** Daftar chat 1-1 (SM-07, gaya Stitch): avatar + waktu relatif + unread, tarik-untuk-muat-ulang. */
export function ChatListScreen({ conversations, loading, error, onRefresh, onSelect }: Props) {
  const firstLoad = loading && conversations.length === 0;
  return (
    <View style={styles.screen}>
      <UIHeader locationText="Sekitarmu" />
      <View style={styles.padded}>
        <Text style={styles.title}>Chat</Text>
        <UIErrorBanner message={friendlyServerError(error)} actionLabel="Coba lagi" onAction={onRefresh} />
      </View>
      {firstLoad ? (
        <View style={styles.padded}>
          <UISkeleton rows={4} />
        </View>
      ) : (
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={conversations}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <UIEmptyState
              illustration="💬"
              title="Belum ada chat"
              message="Cari partner sparing lalu sapa duluan biar ramai!"
            />
          }
          renderItem={({ item }) => {
            const name = item.partner.displayName || item.partner.email;
            const preview = item.lastMessage ? item.lastMessage.body : 'Belum ada pesan — sapa dulu!';
            const stamp = formatRelativeTime(item.lastMessageAt ?? item.lastMessage?.createdAt ?? item.updatedAt);
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => onSelect(item)}
                accessibilityRole="button"
                accessibilityLabel={`Chat dengan ${name}${item.unreadCount > 0 ? `, ${item.unreadCount} belum dibaca` : ''}`}
              >
                <UIAvatar name={item.partner.displayName} email={item.partner.email} uri={item.partner.avatarUrl} size={44} />
                <View style={styles.body}>
                  <View style={styles.topRow}>
                    <Text style={styles.name} numberOfLines={1}>
                      {name}
                    </Text>
                    {stamp ? (
                      <Text style={styles.time} numberOfLines={1}>
                        {stamp}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.bottomRow}>
                    <Text style={styles.preview} numberOfLines={1}>
                      {preview}
                    </Text>
                    {item.unreadCount > 0 ? (
                      <UIBadge kind="unread" label={item.unreadCount > 99 ? '99+' : String(item.unreadCount)} />
                    ) : null}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  padded: { paddingHorizontal: SPACING.screen, paddingTop: SPACING.md },
  title: { ...TYPO.title, color: COLORS.ink, marginBottom: SPACING.sm },
  list: { flex: 1 },
  listContent: { paddingHorizontal: SPACING.screen, paddingBottom: SPACING.screen },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  body: { flex: 1, marginLeft: SPACING.md },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { ...TYPO.cardTitle, color: COLORS.ink, flex: 1, marginRight: SPACING.sm },
  time: { fontSize: 12, fontWeight: '600', color: COLORS.faint },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  preview: { fontSize: 13, color: COLORS.muted, flex: 1, marginRight: SPACING.sm },
});
