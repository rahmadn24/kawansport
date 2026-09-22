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
import { SPORT_SUGGESTIONS, SportEventItem, slotsLeft } from '../api/events';

interface Props {
  events: SportEventItem[];
  loading: boolean;
  error: string | null;
  sportFilter: string | null;
  onFilterChange: (sport: string | null) => void;
  onRefresh: () => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
}

/** Layar Event List (SM-04): filter sport chips + daftar sort datetime ASC. */
export function EventListScreen({
  events,
  loading,
  error,
  sportFilter,
  onFilterChange,
  onRefresh,
  onSelect,
  onCreate,
}: Props) {
  return (
    <View style={styles.box}>
      <Text style={styles.title}>Event</Text>

      <View style={styles.chips}>
        <TouchableOpacity
          style={[styles.chip, !sportFilter && styles.chipActive]}
          onPress={() => onFilterChange(null)}
        >
          <Text style={[styles.chipText, !sportFilter && styles.chipTextActive]}>Semua</Text>
        </TouchableOpacity>
        {SPORT_SUGGESTIONS.map((s) => {
          const active = sportFilter?.toLowerCase() === s.toLowerCase();
          return (
            <TouchableOpacity
              key={s}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onFilterChange(active ? null : s)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{s}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading && events.length === 0 ? (
        <ActivityIndicator />
      ) : (
        <FlatList
          style={styles.list}
          data={events}
          keyExtractor={(item) => item.id}
          onRefresh={onRefresh}
          refreshing={loading}
          ListEmptyComponent={<Text style={styles.empty}>Belum ada event. Buat yang pertama!</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => onSelect(item.id)}>
              <View style={styles.cardRow}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={item.status === 'open' ? styles.open : styles.full}>
                  {item.status === 'open' ? 'OPEN' : 'FULL'}
                </Text>
              </View>
              <Text style={styles.cardSub}>
                {item.sport} • {new Date(item.datetime).toLocaleString()}
              </Text>
              <Text style={styles.cardSub}>
                Slot tersisa {slotsLeft(item)}/{item.capacity}
                {item.distanceMeters != null
                  ? ` • ${(item.distanceMeters / 1000).toFixed(1)} km`
                  : ''}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.gap} />
      <Button title="Buat Event" onPress={onCreate} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, padding: 24 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#888',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: { backgroundColor: '#1a73e8', borderColor: '#1a73e8' },
  chipText: { color: '#333' },
  chipTextActive: { color: '#fff' },
  list: { flex: 1 },
  empty: { textAlign: 'center', color: '#555', marginTop: 24 },
  card: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '700', flex: 1, marginRight: 8 },
  open: { color: '#0a7d2c', fontWeight: '700' },
  full: { color: '#c00', fontWeight: '700' },
  cardSub: { fontSize: 13, color: '#555', marginTop: 4 },
  gap: { height: 12 },
  error: { color: '#c00', marginTop: 8, textAlign: 'center' },
});
