import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  SKILL_LEVELS,
  SKILL_LABELS,
  SPORT_SUGGESTIONS,
  SkillLevel,
  UpdateProfileInput,
  UserProfile,
  toggleSport,
} from '../api/profile';
import { COLORS, SPACING, friendlyServerError } from '../theme';
import {
  UIAppBar,
  UIAvatar,
  UIBadge,
  UIButton,
  UICard,
  UIChip,
  UIErrorBanner,
  UISectionTitle,
  UISegmented,
  UITextInput,
} from '../components/ui';

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

const SKILL_DESC: Record<SkillLevel, string> = {
  beginner: 'Baru mulai, main santai sambil belajar.',
  intermediate: 'Sudah rutin main, siap sparing serius.',
  advanced: 'Sering tanding, cari lawan sepadan.',
};

/**
 * Layar Edit Profile (SM-03): nama, olahraga multi-select, skill
 * segmented, lokasi GPS + manual collapsed, pratinjau live.
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
  const [manualLoc, setManualLoc] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const locSet = lat.trim() !== '' && lng.trim() !== '';
  const shownSports = sports.slice(0, 4);

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
    <View style={styles.screen}>
      <View style={styles.padded}>
        <UIAppBar title="Edit Profil" onBack={onCancel} />
      </View>
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
        <View style={styles.avatarRow}>
          <UIAvatar name={displayName || initial.displayName} email={initial.email} uri={initial.avatarUrl} size={64} />
          <View style={styles.avatarMeta}>
            <Text style={styles.email} numberOfLines={1}>
              {initial.email}
            </Text>
            <Text style={styles.emailSub}>Email tidak bisa diubah</Text>
            {/*
              TODO(GAP-02): wiring galeri -> uploadAvatar butuh dep native
              react-native-image-picker (autolink RN 0.73) + pod install +
              rebuild native; dinonaktifkan jujur sampai bisa diverifikasi
              di device — JANGAN tambah dep tanpa verifikasi. API uploadAvatar
              (POST /me/avatar) sudah siap di src/api/profile.ts.
            */}
            <View style={styles.avatarBtn}>
              <UIButton
                title="Ganti foto (segera hadir)"
                variant="outline"
                onPress={() => undefined}
                disabled
                accessibilityLabel="Ganti foto profil segera hadir, butuh image picker native"
              />
            </View>
          </View>
        </View>

        <UITextInput
          label="Nama tampilan"
          testID="edit-name"
          placeholder="cth. Andi"
          value={displayName}
          onChangeText={setDisplayName}
        />

        <UISectionTitle>Olahraga favorit</UISectionTitle>
        <View style={styles.chips}>
          {SPORT_SUGGESTIONS.map((s) => {
            const active = sports.some((x) => x.toLowerCase() === s.toLowerCase());
            return (
              <UIChip
                key={s}
                label={s}
                active={active}
                onPress={() => setSports((prev) => toggleSport(prev, s))}
                accessibilityLabel={`Olahraga ${s}`}
              />
            );
          })}
        </View>
        {sports.length > 0 ? (
          <View style={styles.chips}>
            {sports
              .filter((s) => !SPORT_SUGGESTIONS.some((x) => x.toLowerCase() === s.toLowerCase()))
              .map((s) => (
                <UIChip key={s} label={`✓ ${s}`} active onPress={() => setSports((prev) => toggleSport(prev, s))} />
              ))}
          </View>
        ) : null}
        <View style={styles.row}>
          <View style={styles.flex}>
            <UITextInput
              label="Tambah olahraga lain"
              testID="edit-custom-sport"
              placeholder="cth. Padel"
              value={customSport}
              onChangeText={setCustomSport}
            />
          </View>
          <View style={styles.gapH} />
          <View style={styles.addBtn}>
            <UIButton title="Tambah" variant="outline" onPress={addCustomSport} accessibilityLabel="Tambah olahraga" />
          </View>
        </View>

        <UISectionTitle>Skill</UISectionTitle>
        <UISegmented<SkillLevel>
          label="Skill"
          value={skillLevel}
          onChange={setSkillLevel}
          options={(SKILL_LEVELS as SkillLevel[]).map((l) => ({ value: l, label: SKILL_LABELS[l] }))}
        />
        {skillLevel ? <Text style={styles.skillDesc}>{SKILL_DESC[skillLevel]}</Text> : null}

        <UISectionTitle>Lokasi</UISectionTitle>
        <UICard>
          <Text style={styles.gpsStatus} accessibilityLabel={locSet ? 'Lokasi sudah ditandai' : 'Lokasi belum ditandai'}>
            {locSet ? '✓ Lokasi sudah ditandai' : '📍 Lokasi belum ditandai'}
          </Text>
          {gpsLoading ? (
            <ActivityIndicator accessibilityLabel="Mencari lokasi GPS" />
          ) : (
            <UIButton title="📍 Pakai GPS" variant="outline" onPress={useGps} accessibilityLabel="Tandai lokasi via GPS" />
          )}
          {gpsError ? <Text style={styles.inlineError}>⚠ {gpsError}</Text> : null}
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
                  testID="edit-lat"
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
                  testID="edit-lng"
                  placeholder="106,8"
                  keyboardType="numbers-and-punctuation"
                  value={lng}
                  onChangeText={setLng}
                />
              </View>
            </View>
          ) : null}
        </UICard>

        <UISectionTitle>Pratinjau kartu partnermu</UISectionTitle>
        <UICard>
          <View style={styles.previewRow}>
            <UIAvatar name={displayName || initial.displayName} email={initial.email} uri={initial.avatarUrl} size={44} />
            <View style={styles.previewMeta}>
              <Text style={styles.previewName} numberOfLines={1}>
                {displayName.trim() || initial.displayName || initial.email}
              </Text>
              <View style={styles.previewBadges}>
                {shownSports.map((s) => (
                  <View key={s} style={styles.miniChip}>
                    <Text style={styles.miniChipText}>{s}</Text>
                  </View>
                ))}
                {skillLevel ? <UIBadge kind="skill" label={SKILL_LABELS[skillLevel]} icon="★" /> : null}
              </View>
            </View>
          </View>
          {shownSports.length === 0 && !skillLevel ? (
            <Text style={styles.previewEmpty}>Lengkapi olahraga & skill biar gampang diajak sparing.</Text>
          ) : null}
        </UICard>

        {localError ? <Text style={styles.inlineError}>⚠ {localError}</Text> : null}
        <UIErrorBanner message={friendlyServerError(serverError)} />
      </ScrollView>

      <View style={styles.sticky}>
        <UIButton
          title="Simpan"
          onPress={submit}
          loading={saving}
          loadingTitle="Menyimpan…"
          accessibilityLabel="Simpan profil"
        />
        <View style={styles.gap} />
        <UIButton title="Batal" variant="ghost" onPress={onCancel} accessibilityLabel="Batal edit profil" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  padded: { paddingHorizontal: SPACING.screen, paddingTop: SPACING.screen },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: SPACING.screen, paddingBottom: SPACING.lg },
  avatarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
  avatarMeta: { flex: 1, marginLeft: SPACING.md },
  email: { fontSize: 15, fontWeight: '700', color: COLORS.ink },
  emailSub: { fontSize: 13, color: COLORS.faint, marginTop: 2 },
  avatarBtn: { marginTop: SPACING.sm, maxWidth: 240 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  flex: { flex: 1 },
  gapH: { width: SPACING.sm },
  gap: { height: SPACING.sm },
  addBtn: { minWidth: 120, paddingTop: 24 },
  skillDesc: { fontSize: 13, color: COLORS.muted, marginTop: SPACING.sm },
  gpsStatus: { fontSize: 14, color: COLORS.ink, fontWeight: '600', marginBottom: SPACING.sm },
  inlineError: { fontSize: 13, color: COLORS.danger, marginTop: SPACING.sm },
  collapse: { minHeight: 44, justifyContent: 'center', marginTop: SPACING.sm },
  collapseText: { fontSize: 14, fontWeight: '700', color: COLORS.brand700 },
  previewRow: { flexDirection: 'row', alignItems: 'center' },
  previewMeta: { flex: 1, marginLeft: SPACING.md },
  previewName: { fontSize: 16, fontWeight: '700', color: COLORS.ink },
  previewBadges: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 6 },
  miniChip: {
    borderRadius: 9999,
    backgroundColor: COLORS.bgAlt,
    borderWidth: 1,
    borderColor: COLORS.line,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    marginRight: 6,
    marginTop: 6,
  },
  miniChipText: { fontSize: 12, fontWeight: '600', color: COLORS.muted },
  previewEmpty: { fontSize: 13, color: COLORS.faint, marginTop: SPACING.sm },
  sticky: {
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
    paddingHorizontal: SPACING.screen,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.screen,
    backgroundColor: COLORS.bg,
  },
});
