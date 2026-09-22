import React, { useState } from 'react';
import {
  ActivityIndicator,
  Button,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  PartnerItem,
  RADIUS_PRESETS,
  SearchPartnersFilter,
  SKILL_LABELS,
  SPORT_SUGGESTIONS,
  SkillLevel,
  formatDistance,
} from '../api/partners';

interface Props {
  partners: PartnerItem[];
  total: number;
  page: number;
  limit: number;
  loading: boolean;
  error: string | null;
  gpsLoading: boolean;
  gpsError: string | null;
  notice: string | null;
  onSearch: (filter: SearchPartnersFilter) => void;
  onLoadMore: () => void;
  hasMore: boolean;
  onUseGps: () => Promise<{ latitude: number; longitude: number }>;
  /** Placeholder sampai chat SM-07: tampilkan notice, jangan navigasi. */
  onInvite: (partner: PartnerItem) => void;
  onChat: (partner: PartnerItem) => void;
}

/**
 * Layar Search Partner (SM-06): sport chips, skill picker, radius
 * preset + manual, lat/lng manual + tombol GPS, list hasil + jarak
 * + tombol invite/chat placeholder.
 */
export function SearchPartnerScreen({
  partners,
  total,
  page,
  limit,
  loading,
  error,
  gpsLoading,
  gpsError,
  notice,
  onSearch,
  onLoadMore,
  hasMore,
  onUseGps,
  onInvite,
  onChat,
}: Props) {
  const [sport, setSport] = useState<string | null>(null);
  const [skill, setSkill] = useState<SkillLevel | null>(null);
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [radius, setRadius] = useState('10000');
  const [localError, setLocalError] = useState<string | null>(null);

  const useGps = async () => {
    try {
      const pos = await onUseGps();
      setLat(String(pos.latitude));
      setLng(String(pos.longitude));
    } catch {
      // Pesan error GPS ditampilkan induk via props gpsError.
    }
  };

  const submit = () => {
    const latTrim = lat.trim();
    const lngTrim = lng.trim();
    if ((latTrim === '') !== (lngTrim === '')) {
      setLocalError('Lat dan Lng harus diisi berpasangan (atau keduanya kosong)');
      return;
    }
    let latNum: number | undefined;
    let lngNum: number | undefined;
    if (latTrim !== '') {
      latNum = Number(latTrim.replace(',', '.'));
      lngNum = Number(lngTrim.replace(',', '.'));
      if (!Number.isFinite(latNum) || latNum < -90 || latNum > 90) {
        setLocalError('Lat harus angka -90 s/d 90');
        return;
      }
      if (lngNum == null || !Number.isFinite(lngNum) || lngNum < -180 || lngNum > 180) {
        setLocalError('Lng harus angka -180 s/d 180');
        return;
      }
    }
    const radiusNum = Number(radius.trim().replace(',', '.'));
    if (!Number.isFinite(radiusNum) || radiusNum < 100 || radiusNum > 100000) {
      setLocalError('Radius harus 100..100000 meter');
      return;
    }
    setLocalError(null);
    onSearch({
      ...(sport ? { sport } : {}),
      ...(skill ? { skill } : {}),
      ...(latNum !== undefined ? { lat: latNum, lng: lngNum as number, radius: Math.round(radiusNum) } : {}),
      page: 1,
      limit,
    });
  };

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Cari Partner</Text>

      <Text style={styles.label}>Olahraga</Text>
      <View style={styles.chips}>
        <TouchableOpacity
          style={[styles.chip, !sport && styles.chipActive]}
          onPress={() => setSport(null)}
        >
          <Text style={[styles.chipText, !sport && styles.chipTextActive]}>Semua</Text>
        </TouchableOpacity>
        {SPORT_SUGGESTIONS.map((s) => {
          const active = sport?.toLowerCase() === s.toLowerCase();
          return (
            <TouchableOpacity
              key={s}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setSport(active ? null : s)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{s}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.label}>Skill</Text>
      <View style={styles.chips}>
        <TouchableOpacity
          style={[styles.chip, !skill && styles.chipActive]}
          onPress={() => setSkill(null)}
        >
          <Text style={[styles.chipText, !skill && styles.chipTextActive]}>Semua</Text>
        </TouchableOpacity>
        {(Object.keys(SKILL_LABELS) as SkillLevel[]).map((level) => {
          const active = skill === level;
          return (
            <TouchableOpacity
              key={level}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setSkill(active ? null : level)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {SKILL_LABELS[level]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.label}>Radius (meter)</Text>
      <View style={styles.chips}>
        {RADIUS_PRESETS.map((r) => {
          const active = Number(radius) === r;
          return (
            <TouchableOpacity
              key={r}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setRadius(String(r))}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {r >= 1000 ? `${r / 1000} km` : `${r} m`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <TextInput
        style={styles.input}
        placeholder="Radius manual 100..100000"
        keyboardType="numbers-and-punctuation"
        value={radius}
        onChangeText={setRadius}
      />

      <Text style={styles.label}>Lokasi (lat / lng)</Text>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, styles.flex]}
          placeholder="Lat (-90..90)"
          keyboardType="numbers-and-punctuation"
          value={lat}
          onChangeText={setLat}
        />
        <View style={styles.gapH} />
        <TextInput
          style={[styles.input, styles.flex]}
          placeholder="Lng (-180..180)"
          keyboardType="numbers-and-punctuation"
          value={lng}
          onChangeText={setLng}
        />
      </View>
      {gpsLoading ? (
        <ActivityIndicator />
      ) : (
        <Button title="Gunakan GPS" onPress={useGps} />
      )}
      {gpsError ? <Text style={styles.error}>{gpsError}</Text> : null}

      {localError ? <Text style={styles.error}>{localError}</Text> : null}
      <View style={styles.gap} />
      {loading && partners.length === 0 ? (
        <ActivityIndicator />
      ) : (
        <Button title="Cari" onPress={submit} />
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <Text style={styles.meta}>
        {total > 0 ? `${total} partner • hal ${page}` : 'Belum ada hasil. Tekan Cari.'}
      </Text>
      <FlatList
        style={styles.list}
        data={partners}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          loading ? null : <Text style={styles.empty}>Tidak ada partner cocok.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.displayName || item.email}</Text>
            <Text style={styles.cardSub}>
              {(item.sports ?? []).join(', ') || 'Belum ada olahraga'}
              {item.skillLevel ? ` • ${SKILL_LABELS[item.skillLevel]}` : ''}
            </Text>
            <Text style={styles.cardSub}>
              {item.distanceMeters != null ? `${formatDistance(item.distanceMeters)}` : 'Jarak —'}
            </Text>
            <View style={styles.cardRow}>
              <View style={styles.flex}>
                <Button title="Invite" onPress={() => onInvite(item)} />
              </View>
              <View style={styles.gapH} />
              <View style={styles.flex}>
                <Button title="Chat" onPress={() => onChat(item)} />
              </View>
            </View>
          </View>
        )}
      />
      {hasMore ? <Button title={loading ? 'Memuat…' : 'Muat lagi'} onPress={onLoadMore} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, padding: 24 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  label: { fontSize: 14, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
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
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  gap: { height: 12 },
  gapH: { width: 8 },
  error: { color: '#c00', marginTop: 8, textAlign: 'center' },
  notice: { color: '#1a73e8', marginTop: 8, textAlign: 'center' },
  meta: { fontSize: 13, color: '#555', marginTop: 12, marginBottom: 4, textAlign: 'center' },
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
  cardRow: { flexDirection: 'row', marginTop: 8 },
});
