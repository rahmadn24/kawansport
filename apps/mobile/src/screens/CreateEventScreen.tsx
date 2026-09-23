import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  CreateEventInput,
  SPORT_SUGGESTIONS,
  validateCreateEvent,
} from '../api/events';
import { getCurrentPosition } from '../location/geolocation';
import { COLORS, SPACING, TYPO, formatWIB, friendlyServerError } from '../theme';
import {
  UIAppBar,
  UIButton,
  UICard,
  UIChip,
  UIErrorBanner,
  UISectionTitle,
  UITextInput,
} from '../components/ui';

interface Props {
  saving: boolean;
  serverError: string | null;
  onSubmit: (input: CreateEventInput) => void;
  onCancel: () => void;
}

function todayKey(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Layar Create Event (SM-04): seksi olahraga/detail/waktu/lokasi/kapasitas + ringkasan. */
export function CreateEventScreen({ saving, serverError, onSubmit, onCancel }: Props) {
  const [sport, setSport] = useState('');
  const [customSport, setCustomSport] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayKey());
  const [time, setTime] = useState('09:00');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [manualLoc, setManualLoc] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [capacity, setCapacity] = useState(10);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const chosenSport = sport.trim() || customSport.trim();
  const locSet = lat.trim() !== '' && lng.trim() !== '';
  const combinedIso = `${date.trim()}T${time.trim()}:00+07:00`;
  const isoValid = !Number.isNaN(Date.parse(combinedIso));

  const useGps = async () => {
    setGpsLoading(true);
    setGpsError(null);
    try {
      const pos = await getCurrentPosition();
      setLat(String(pos.latitude));
      setLng(String(pos.longitude));
    } catch (e) {
      setGpsError(e instanceof Error ? e.message : 'Gagal mendapatkan lokasi GPS');
    } finally {
      setGpsLoading(false);
    }
  };

  const submit = () => {
    const input: CreateEventInput = {
      sport: chosenSport,
      title: title.trim(),
      description: description.trim() || undefined,
      datetime: combinedIso,
      lat: Number(lat.trim().replace(',', '.')),
      lng: Number(lng.trim().replace(',', '.')),
      capacity,
    };
    const errs: Record<string, string> = {};
    if (!chosenSport) errs.sport = 'Pilih atau ketik olahraga';
    if (!title.trim()) errs.title = 'Judul wajib diisi';
    if (!isoValid) errs.datetime = 'Tanggal/jam tidak valid';
    if (!locSet) errs.location = 'Tandai lokasi via GPS atau isi manual';
    if (!Number.isInteger(capacity) || capacity < 2 || capacity > 500) {
      errs.capacity = 'Kapasitas 2–500 orang';
    }
    const serverSide = validateCreateEvent(input);
    if (serverSide && Object.keys(errs).length === 0) errs.form = serverSide;
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;
    onSubmit(input);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.padded}>
        <UIAppBar title="Buat Event" onBack={onCancel} />
      </View>
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
        <UISectionTitle>S1 • Olahraga</UISectionTitle>
        <View style={styles.chips}>
          {SPORT_SUGGESTIONS.map((s) => {
            const active = sport.toLowerCase() === s.toLowerCase();
            return (
              <UIChip
                key={s}
                label={s}
                active={active}
                onPress={() => {
                  setSport(active ? '' : s);
                  setCustomSport('');
                }}
              />
            );
          })}
        </View>
        <UITextInput
          label="Atau ketik olahraga lain"
          testID="create-custom-sport"
          placeholder="cth. Padel"
          value={customSport}
          onChangeText={(v) => {
            setCustomSport(v);
            if (v.trim()) setSport('');
          }}
          error={fieldErrors.sport}
        />

        <UISectionTitle>S2 • Detail</UISectionTitle>
        <UITextInput
          label="Judul"
          testID="create-title"
          placeholder="cth. Sparing Sabtu Pagi"
          value={title}
          onChangeText={setTitle}
          error={fieldErrors.title}
        />
        <UITextInput
          label="Deskripsi (opsional)"
          testID="create-desc"
          placeholder="Level main, biaya, titik kumpul…"
          value={description}
          onChangeText={setDescription}
          multiline
        />

        <UISectionTitle>S3 • Waktu</UISectionTitle>
        <View style={styles.row}>
          <View style={styles.flex}>
            <UITextInput
              label="Tanggal"
              testID="create-date"
              placeholder="2026-10-03"
              value={date}
              onChangeText={setDate}
            />
          </View>
          <View style={styles.gapH} />
          <View style={styles.flex}>
            <UITextInput
              label="Jam"
              testID="create-time"
              placeholder="09:00"
              value={time}
              onChangeText={setTime}
            />
          </View>
        </View>
        {fieldErrors.datetime ? <Text style={styles.inlineError}>⚠ {fieldErrors.datetime}</Text> : null}
        <Text style={styles.summary} accessibilityLabel={`Ringkasan waktu: ${isoValid ? formatWIB(combinedIso) : 'belum valid'}`}>
          🕘 {isoValid ? formatWIB(combinedIso) : 'Isi tanggal & jam yang valid'}
        </Text>

        <UISectionTitle>S4 • Lokasi</UISectionTitle>
        <UICard>
          {gpsLoading ? (
            <ActivityIndicator accessibilityLabel="Mencari lokasi GPS" />
          ) : (
            <UIButton
              title={locSet ? '✓ Lokasi sudah ditandai — Perbarui via GPS' : '📍 Tandai Lokasiku via GPS'}
              variant="outline"
              onPress={useGps}
              accessibilityLabel="Tandai lokasi via GPS"
            />
          )}
          {gpsError ? <Text style={styles.inlineError}>⚠ {gpsError}</Text> : null}
          {fieldErrors.location && !locSet ? <Text style={styles.inlineError}>⚠ {fieldErrors.location}</Text> : null}
          {locSet && !manualLoc ? (
            <Text style={styles.locOk}>✓ Titik lokasi tersimpan. Tinggal buat event!</Text>
          ) : null}
          <TouchableOpacity
            onPress={() => setManualLoc((v) => !v)}
            style={styles.collapse}
            accessibilityRole="button"
            accessibilityLabel={manualLoc ? 'Sembunyikan isi lokasi manual' : 'Isi lokasi manual'}
          >
            <Text style={styles.collapseText}>{manualLoc ? '▾ Sembunyikan isi manual' : '▸ Isi manual (lat/lng)'}</Text>
          </TouchableOpacity>
          {manualLoc ? (
            <View style={styles.row}>
              <View style={styles.flex}>
                <UITextInput
                  label="Lat"
                  testID="create-lat"
                  placeholder="-6,2"
                  keyboardType="numbers-and-punctuation"
                  value={lat}
                  onChangeText={setLat}
                />
              </View>
              <View style={styles.gapH} />
              <View style={styles.flex}>
                <UITextInput
                  label="Lng"
                  testID="create-lng"
                  placeholder="106,8"
                  keyboardType="numbers-and-punctuation"
                  value={lng}
                  onChangeText={setLng}
                />
              </View>
            </View>
          ) : null}
        </UICard>

        <UISectionTitle>S5 • Kapasitas</UISectionTitle>
        <View style={styles.stepper} accessibilityLabel={`Kapasitas ${capacity} orang`}>
          <TouchableOpacity
            style={styles.stepBtn}
            onPress={() => setCapacity((c) => Math.max(2, c - 1))}
            disabled={capacity <= 2}
            accessibilityRole="button"
            accessibilityLabel="Kurangi kapasitas"
          >
            <Text style={styles.stepText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.stepValue}>{capacity} orang</Text>
          <TouchableOpacity
            style={styles.stepBtn}
            onPress={() => setCapacity((c) => Math.min(500, c + 1))}
            disabled={capacity >= 500}
            accessibilityRole="button"
            accessibilityLabel="Tambah kapasitas"
          >
            <Text style={styles.stepText}>＋</Text>
          </TouchableOpacity>
        </View>
        {fieldErrors.capacity ? <Text style={styles.inlineError}>⚠ {fieldErrors.capacity}</Text> : null}

        <UISectionTitle>Ringkasan</UISectionTitle>
        <UICard>
          <Text style={styles.sumTitle}>{title.trim() || 'Judul event'}</Text>
          <Text style={styles.sumLine}>
            {chosenSport || 'Olahraga'} • {isoValid ? formatWIB(combinedIso) : 'Jadwal menyusul'}
          </Text>
          <Text style={styles.sumLine}>
            {capacity} orang • {locSet ? 'Lokasi ditandai ✓' : 'Lokasi belum ditandai'}
          </Text>
        </UICard>

        {fieldErrors.form ? <Text style={styles.inlineError}>⚠ {fieldErrors.form}</Text> : null}
        <UIErrorBanner message={friendlyServerError(serverError)} />
      </ScrollView>

      <View style={styles.sticky}>
        <UIButton
          title="Buat Event"
          variant="accent"
          onPress={submit}
          loading={saving}
          loadingTitle="Menyimpan event…"
          accessibilityLabel="Buat event baru"
        />
        <View style={styles.gap} />
        <UIButton title="Batal" variant="ghost" onPress={onCancel} accessibilityLabel="Batal buat event" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  padded: { paddingHorizontal: SPACING.screen, paddingTop: SPACING.screen },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: SPACING.screen, paddingBottom: SPACING.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  flex: { flex: 1 },
  gapH: { width: SPACING.sm },
  gap: { height: SPACING.sm },
  summary: { fontSize: 14, color: COLORS.brand700, fontWeight: '700', marginTop: SPACING.sm },
  inlineError: { fontSize: 13, color: COLORS.danger, marginTop: SPACING.xs },
  locOk: { fontSize: 14, color: COLORS.brand700, fontWeight: '600', marginTop: SPACING.sm },
  collapse: { minHeight: 44, justifyContent: 'center', marginTop: SPACING.sm },
  collapseText: { fontSize: 14, fontWeight: '700', color: COLORS.brand700 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepBtn: {
    minWidth: 48,
    minHeight: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: COLORS.brand700,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { fontSize: 22, fontWeight: '800', color: COLORS.brand700 },
  stepValue: { ...TYPO.angka, color: COLORS.ink },
  sumTitle: { ...TYPO.cardTitle, color: COLORS.ink },
  sumLine: { fontSize: 13, color: COLORS.muted, marginTop: SPACING.xs },
  sticky: {
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
    paddingHorizontal: SPACING.screen,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.screen,
    backgroundColor: COLORS.bg,
  },
});
