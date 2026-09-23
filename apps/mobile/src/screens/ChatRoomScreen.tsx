import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { ChatMessage } from '../api/chat';
import { COLORS, RADIUS, SPACING, friendlyServerError } from '../theme';
import { UIButton, UIEmptyState, UIErrorBanner, UISkeleton } from '../components/ui';
import { formatClockWIB } from '../mocks/stitch';

interface Props {
  messages: ChatMessage[];
  myId: string | null;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  connected: boolean;
  socketError: string | null;
  polling: boolean;
  sending: boolean;
  sendError: string | null;
  onBack: () => void;
  onLoadMore: () => void;
  onSend: (body: string) => void;
}

/**
 * Ruang chat 1-1 (SM-07, gaya Stitch): bubble hijau-muda milikku / putih
 * lawan + nama + jam, status bahasa manusia, composer 48 + tombol kirim primer.
 * Prop `polling`/`socketError` tetap diterima dari induk (logika sinkronisasi
 * tak berubah) tapi TIDAK ditampilkan mentah ke pengguna.
 */
export function ChatRoomScreen({
  messages,
  myId,
  loading,
  loadingMore,
  hasMore,
  error,
  connected,
  socketError,
  polling,
  sending,
  sendError,
  onBack,
  onLoadMore,
  onSend,
}: Props) {
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList>(null);

  const submit = () => {
    const body = draft.trim();
    if (!body || sending) return;
    setDraft('');
    onSend(body);
  };

  // Bahasa manusia: hanya "Terhubung langsung" vs "Menyambung…".
  const live = connected && !socketError && !polling;
  const status = live ? 'Terhubung langsung' : 'Menyambung…';

  const firstLoad = loading && messages.length === 0;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Kembali ke daftar chat"
        >
          <Text style={styles.backText}>‹ Kembali</Text>
        </TouchableOpacity>
        <View style={styles.statusWrap}>
          <View style={[styles.dot, live && styles.dotLive]} accessibilityElementsHidden />
          <Text style={styles.status} accessibilityLabel={`Status chat: ${status}`}>
            {status}
          </Text>
        </View>
      </View>

      {firstLoad ? (
        <View style={styles.padded}>
          <UISkeleton rows={3} />
        </View>
      ) : error && messages.length === 0 ? (
        <View style={styles.padded}>
          <UIErrorBanner message={friendlyServerError(error)} />
          <UIButton title="Coba lagi" variant="outline" onPress={onLoadMore} accessibilityLabel="Coba muat pesan lagi" />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={messages}
          keyExtractor={(item) => item.id}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <UIEmptyState
              illustration="👋"
              title="Belum ada pesan"
              message="Sapa dulu! Obrolan ringan buka jalan ke mabar seru."
            />
          }
          ListHeaderComponent={
            hasMore ? (
              <View style={styles.more}>
                <UIButton
                  title={loadingMore ? 'Memuat…' : 'Muat pesan lama'}
                  variant="ghost"
                  onPress={onLoadMore}
                  disabled={loadingMore}
                  accessibilityLabel="Muat pesan yang lebih lama"
                />
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const mine = myId != null && item.senderId === myId;
            return (
              <View style={[styles.bubbleRow, mine ? styles.mineRow : styles.theirsRow]}>
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  {!mine ? (
                    <Text style={styles.senderName} numberOfLines={1}>
                      Kawan main
                    </Text>
                  ) : null}
                  <Text style={styles.bubbleText}>{item.body}</Text>
                  <Text style={[styles.bubbleTime, mine ? styles.bubbleTimeMine : styles.bubbleTimeTheirs]}>
                    {formatClockWIB(item.createdAt)}
                    {mine && item.readAt ? ' • Dibaca' : ''}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}

      <View style={styles.foot}>
        <UIErrorBanner message={friendlyServerError(sendError)} />
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            placeholder="Tulis pesan…"
            placeholderTextColor={COLORS.faint}
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={submit}
            editable={!sending}
            accessibilityLabel="Tulis pesan chat"
            returnKeyType="send"
          />
          {sending ? (
            <ActivityIndicator style={styles.sendSpin} accessibilityLabel="Mengirim pesan" />
          ) : (
            <UIButton
              title="Kirim"
              onPress={submit}
              disabled={!draft.trim()}
              accessibilityLabel="Kirim pesan"
              testID="chat-send"
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bgAlt },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.bg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
    paddingHorizontal: SPACING.screen,
    paddingVertical: SPACING.sm,
    minHeight: 56,
  },
  back: { minHeight: 44, justifyContent: 'center', minWidth: 80 },
  backText: { fontSize: 15, fontWeight: '700', color: COLORS.brand700 },
  statusWrap: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.star, marginRight: 6 },
  dotLive: { backgroundColor: COLORS.brand600 },
  status: { fontSize: 12, fontWeight: '600', color: COLORS.muted },
  padded: { paddingHorizontal: SPACING.screen, paddingTop: SPACING.screen },
  list: { flex: 1 },
  listContent: { paddingHorizontal: SPACING.screen, paddingVertical: SPACING.md },
  more: { marginBottom: SPACING.sm },
  bubbleRow: { flexDirection: 'row', marginBottom: SPACING.sm },
  mineRow: { justifyContent: 'flex-end' },
  theirsRow: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '80%',
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  bubbleMine: { backgroundColor: COLORS.brand100, borderBottomRightRadius: 6 },
  bubbleTheirs: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderBottomLeftRadius: 6,
  },
  senderName: { fontSize: 12, fontWeight: '700', color: COLORS.brand700, marginBottom: 2 },
  bubbleText: { fontSize: 14, color: COLORS.ink, lineHeight: 20 },
  bubbleTime: { fontSize: 11, color: COLORS.faint, marginTop: 4, textAlign: 'right' },
  bubbleTimeMine: {},
  bubbleTimeTheirs: {},
  foot: {
    backgroundColor: COLORS.bg,
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
    paddingHorizontal: SPACING.screen,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.screen,
  },
  composer: { flexDirection: 'row', alignItems: 'center' },
  input: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    fontSize: 15,
    color: COLORS.ink,
    backgroundColor: COLORS.bg,
    marginRight: SPACING.sm,
  },
  sendSpin: { minWidth: 120, minHeight: 48 },
});
