import React, { useState } from 'react';
import {
  ActivityIndicator,
  Button,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  SKILL_LEVELS,
  SKILL_LABELS,
  SPORT_SUGGESTIONS,
  SkillLevel,
  UpdateProfileInput,
  UserProfile,
  toggleSport,
} from '../api/profile';

interface Props {
  initial: UserProfile;
  saving: boolean;
  serverError: string | null;
  gpsLoading: boolean;
  gpsError: string | null;
  onSave: (input: UpdateProfileInput) => void;
  /** Minta koordinat GPS; screen mengisi field lat/lng dari hasilnya. */
  onUseGps: () => Promise<{ latitude: number; longitude: number }>;
  onCancel: () => void;
}

/**
 * Layar Edit Profile (SM-03): sports multi-select, skill picker,
 * lokasi manual lat/lng + tombol GPS.
 */
export function EditProfileScreen({
  initial,
  saving,
  serverError,
  gpsLoading,
  gpsError,
  onSave,
  onUseGps,
  onCancel,
}: Props) {
  const [displayName, setDisplayName] = useState(initial.displayName ?? '');
  const [sports, setSports] = useState<string[]>(initial.sports ?? []);
  const [customSport, setCustomSport] = useState('');
  const [skillLevel, setSkillLevel] = useState<SkillLevel | null>(initial.skillLevel ?? null);
  const [lat, setLat] = useState(initial.lat != null ? String(initial.lat) : '');
  const [lng, setLng] = useState(initial.lng != null ? String(initial.lng) : '');
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = () => {
    const latTrim = lat.trim();
    const lngTrim = lng.trim();
    if ((latTrim === '') !== (lngTrim === '')) {
      setLocalError('Lat dan Lng harus diisi berpasangan (atau keduanya kosong)');
      return;
    }
    let latNum: number | null | undefined;
    let lngNum: number | null | undefined;
    if (latTrim === '' && lngTrim === '') {
      // Keduanya kosong: biarkan lokasi apa adanya (tidak dikirim).
      latNum = undefined;
      lngNum = undefined;
    } else {
      latNum = Number(latTrim.replace(',', '.'));
      lngNum = Number(lngTrim.replace(',', '.'));
      if (!Number.isFinite(latNum) || latNum < -90 || latNum > 90) {
        setLocalError('Lat harus angka -90 s/d 90');
        return;
      }
      if (!Number.isFinite(lngNum) || lngNum < -180 || lngNum > 180) {
        setLocalError('Lng harus angka -180 s/d 180');
        return;
      }
    }
    setLocalError(null);
    onSave({
      displayName: displayName.trim(),
      sports,
      skillLevel,
      ...(latNum !== undefined ? { lat: latNum, lng: lngNum ?? null } : {}),
    });
  };

  const addCustomSport = () => {
    if (!customSport.trim()) return;
    setSports((prev) => toggleSport(prev, customSport));
    setCustomSport('');
  };

  const useGps = async () => {
    try {
      const pos = await onUseGps();
      setLat(String(pos.latitude));
      setLng(String(pos.longitude));
    } catch {
      // Pesan error GPS ditampilkan induk via props gpsError.
    }
  };

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Edit Profil</Text>

      <Text style={styles.label}>Nama tampilan</Text>
      <TextInput
        style={styles.input}
        placeholder="Nama tampilan"
        value={displayName}
        onChangeText={setDisplayName}
      />

      <Text style={styles.label}>Olahraga favorit</Text>
      <View style={styles.chips}>
        {SPORT_SUGGESTIONS.map((s) => {
          const active = sports.some((x) => x.toLowerCase() === s.toLowerCase());
          return (
            <TouchableOpacity
              key={s}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setSports((prev) => toggleSport(prev, s))}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{s}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, styles.flex]}
          placeholder="Tambah olahraga lain"
          value={customSport}
          onChangeText={setCustomSport}
        />
        <View style={styles.gapH} />
        <Button title="Tambah" onPress={addCustomSport} />
      </View>

      <Text style={styles.label}>Skill level</Text>
      <View style={styles.chips}>
        {(SKILL_LEVELS as SkillLevel[]).map((level) => {
          const active = skillLevel === level;
          return (
            <TouchableOpacity
              key={level}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setSkillLevel(active ? null : level)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {SKILL_LABELS[level]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

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
      {serverError ? <Text style={styles.error}>{serverError}</Text> : null}
      <View style={styles.gap} />
      {saving ? (
        <ActivityIndicator />
      ) : (
        <View style={styles.row}>
          <View style={styles.flex}>
            <Button title="Simpan" onPress={submit} />
          </View>
          <View style={styles.gapH} />
          <View style={styles.flex}>
            <Button title="Batal" onPress={onCancel} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, padding: 24, justifyContent: 'flex-start' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
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
});
