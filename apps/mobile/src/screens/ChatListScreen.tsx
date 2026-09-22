import React from 'react';
import {
  ActivityIndicator,
  Button,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { ConversationItem } from '../api/chat';

interface Props {
  conversations: ConversationItem[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onSelect: (conv: ConversationItem) => void;
}

/** Daftar conversation + last message + unread badge (SM-07). */
export function ChatListScreen({ conversations, loading, error, onRefresh, onSelect }: Props) {
  return (
    <View style={styles.box}>
      <Text style={styles.title}>Chat</Text>
      {loading && conversations.length === 0 ? (
        <ActivityIndicator />
      ) : (
        <Button title="Refresh" onPress={onRefresh} />
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        style={styles.list}
        data={conversations}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          loading ? null : <Text style={styles.empty}>Belum ada percakapan.</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => onSelect(item)}>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>
                  {item.partner.displayName || item.partner.email}
                </Text>
                <Text style={styles.cardSub} numberOfLines={1}>
                  {item.lastMessage ? item.lastMessage.body : 'Belum ada pesan'}
                </Text>
              </View>
              {item.unreadCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {item.unreadCount > 99 ? '99+' : String(item.unreadCount)}
                  </Text>
                </View>
              ) : null}
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, padding: 24 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  error: { color: '#c00', marginTop: 8, textAlign: 'center' },
  list: { flex: 1, marginTop: 12 },
  empty: { textAlign: 'center', color: '#555', marginTop: 24 },
  card: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardSub: { fontSize: 13, color: '#555', marginTop: 4 },
  badge: {
    backgroundColor: '#c00',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
