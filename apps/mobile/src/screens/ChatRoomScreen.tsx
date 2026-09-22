import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Button,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { ChatMessage } from '../api/chat';

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
 * Ruang chat 1-1 (SM-07): bubble pesan, auto-scroll ke bawah,
 * optimistic UI (diatur induk via onSend), polling fallback tiap 5 dtk
 * bila socket terputus (indikator "polling" tampil).
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
    if (!body) return;
    setDraft('');
    onSend(body);
  };

  const status = polling
    ? 'polling (socket terputus)'
    : connected
      ? 'realtime'
      : 'menghubungkan…';

  return (
    <View style={styles.box}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Button title="‹ Kembali" onPress={onBack} />
        </View>
        <Text style={styles.status}>{status}</Text>
      </View>
      {socketError && !polling ? <Text style={styles.notice}>{socketError}</Text> : null}
      {loading && messages.length === 0 ? (
        <ActivityIndicator />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <FlatList
          ref={listRef}
          style={styles.list}
          data={messages}
          keyExtractor={(item) => item.id}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={<Text style={styles.empty}>Belum ada pesan. Sapa dulu!</Text>}
          ListHeaderComponent={
            hasMore ? (
              <View style={styles.more}>
                <Button
                  title={loadingMore ? 'Memuat…' : 'Muat pesan lama'}
                  onPress={onLoadMore}
                />
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const mine = myId != null && item.senderId === myId;
            return (
              <View style={[styles.bubbleRow, mine ? styles.mine : styles.theirs]}>
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>
                    {item.body}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}
      {sendError ? <Text style={styles.error}>{sendError}</Text> : null}
      <View style={styles.composer}>
        <TextInput
          style={[styles.input, styles.flex]}
          placeholder="Tulis pesan…"
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={submit}
          editable={!sending}
        />
        <View style={styles.gapH} />
        {sending ? <ActivityIndicator /> : <Button title="Kirim" onPress={submit} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  flex: { flex: 1 },
  status: { fontSize: 12, color: '#555' },
  notice: { color: '#b60', marginBottom: 8, textAlign: 'center' },
  error: { color: '#c00', marginTop: 8, textAlign: 'center' },
  list: { flex: 1 },
  empty: { textAlign: 'center', color: '#555', marginTop: 24 },
  more: { marginBottom: 8 },
  bubbleRow: { flexDirection: 'row', marginBottom: 8 },
  mine: { justifyContent: 'flex-end' },
  theirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleMine: { backgroundColor: '#1a73e8' },
  bubbleTheirs: { backgroundColor: '#eee' },
  bubbleText: { fontSize: 14, color: '#111' },
  bubbleTextMine: { color: '#fff' },
  composer: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  gapH: { width: 8 },
});
