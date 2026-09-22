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
import { VenueItem } from '../api/venues';
import { formatDistance } from '../api/partners';

interface Props {
  venues: VenueItem[];
  loading: boolean;
  error: string | null;
  sportFilter: string | null;
  onFilterChange: (sport: string | null) => void;
  onRefresh: () => void;
  onSelect: (id: string) => void;
  /** Konteks event bila alur berasal dari tombol Book Court di EventDetail. */
  eventLabel: string | null;
}

/** Layar Venue List (BK-04): filter sport + daftar venue approved. */
export function VenueListScreen({
  venues,
  loading,
  error,
  sportFilter,
  onFilterChange,
  onRefresh,
  onSelect,
  eventLabel,
}: Props) {
  return (
    <View style={styles.box}>
      <Text style={styles.title}>Venue</Text>
      {eventLabel ? <Text style={styles.ctx}>Booking untuk: {eventLabel}</Text> : null}

      <View style={styles.chips}>
        <TouchableOpacity
          style={[styles.chip, !sportFilter && styles.chipActive]}
          onPress={() => onFilterChange(null)}
        >
          <Text style={[styles.chipText, !sportFilter && styles.chipTextActive]}>Semua</Text>
        </TouchableOpacity>
        {['Futsal', 'Basket', 'Badminton', 'Tenis', 'Voli'].map((s) => {
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

      {loading && venues.length === 0 ? (
        <ActivityIndicator />
      ) : (
        <FlatList
          style={styles.list}
          data={venues}
          keyExtractor={(item) => item.id}
          onRefresh={onRefresh}
          refreshing={loading}
          ListEmptyComponent={<Text style={styles.empty}>Belum ada venue.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => onSelect(item.id)}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardSub}>
                {item.sports.join(', ')} • {item.address}
              </Text>
              <Text style={styles.cardSub}>
                {(item.courts ?? []).length} lapangan
                {item.distanceMeters != null ? ` • ${formatDistance(item.distanceMeters)}` : ''}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.gap} />
      <Button title="Refresh" onPress={onRefresh} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, padding: 24 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 4, textAlign: 'center' },
  ctx: { fontSize: 13, color: '#1a73e8', textAlign: 'center', marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8, marginTop: 8 },
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
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardSub: { fontSize: 13, color: '#555', marginTop: 4 },
  gap: { height: 12 },
  error: { color: '#c00', marginTop: 8, textAlign: 'center' },
});
