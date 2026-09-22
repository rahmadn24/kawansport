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
  CreateEventInput,
  SPORT_SUGGESTIONS,
  validateCreateEvent,
} from '../api/events';

interface Props {
  saving: boolean;
  serverError: string | null;
  onSubmit: (input: CreateEventInput) => void;
  onCancel: () => void;
}

/** Layar Create Event (SM-04): sport chips + judul + waktu ISO + lat/lng + kapasitas. */
export function CreateEventScreen({ saving, serverError, onSubmit, onCancel }: Props) {
  const [sport, setSport] = useState('');
  const [customSport, setCustomSport] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [datetime, setDatetime] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [capacity, setCapacity] = useState('10');
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = () => {
    const chosenSport = sport.trim() || customSport.trim();
    const input: CreateEventInput = {
      sport: chosenSport,
      title: title.trim(),
      description: description.trim() || undefined,
      datetime: datetime.trim(),
      lat: Number(lat.trim().replace(',', '.')),
      lng: Number(lng.trim().replace(',', '.')),
      capacity: Number(capacity.trim()),
    };
    const err = validateCreateEvent(input);
    if (err) {
      setLocalError(err);
      return;
    }
    setLocalError(null);
    onSubmit(input);
  };

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Buat Event</Text>

      <Text style={styles.label}>Olahraga</Text>
      <View style={styles.chips}>
        {SPORT_SUGGESTIONS.map((s) => {
          const active = sport.toLowerCase() === s.toLowerCase();
          return (
            <TouchableOpacity
              key={s}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => {
                setSport(active ? '' : s);
                setCustomSport('');
              }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{s}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <TextInput
        style={styles.input}
        placeholder="Atau ketik olahraga lain"
        value={customSport}
        onChangeText={(v) => {
          setCustomSport(v);
          if (v.trim()) setSport('');
        }}
      />

      <Text style={styles.label}>Judul</Text>
      <TextInput
        style={styles.input}
        placeholder="cth. Sparing Sabtu Pagi"
        value={title}
        onChangeText={setTitle}
      />

      <Text style={styles.label}>Deskripsi (opsional)</Text>
      <TextInput
        style={styles.input}
        placeholder="Detail event, level, biaya, dsb."
        value={description}
        onChangeText={setDescription}
      />

      <Text style={styles.label}>Waktu (ISO, cth. 2026-10-03T09:00:00+07:00)</Text>
      <TextInput
        style={styles.input}
        placeholder="2026-10-03T09:00:00+07:00"
        value={datetime}
        onChangeText={setDatetime}
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

      <Text style={styles.label}>Kapasitas (2..500)</Text>
      <TextInput
        style={styles.input}
        placeholder="10"
        keyboardType="number-pad"
        value={capacity}
        onChangeText={setCapacity}
      />

      {localError ? <Text style={styles.error}>{localError}</Text> : null}
      {serverError ? <Text style={styles.error}>{serverError}</Text> : null}
      <View style={styles.gap} />
      {saving ? (
        <ActivityIndicator />
      ) : (
        <View style={styles.row}>
          <View style={styles.flex}>
            <Button title="Buat" onPress={submit} />
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
