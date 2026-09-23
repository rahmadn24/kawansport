import React, { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import {
  PartnerItem,
  RADIUS_PRESETS,
  SearchPartnersFilter,
  SKILL_LABELS,
  SPORT_SUGGESTIONS,
  SkillLevel,
  formatDistance,
} from '../api/partners';
import { COLORS, SPACING, TYPO, friendlyServerError } from '../theme';
import {
  UIAppBar,
  UIAvatar,
  UIBadge,
  UIButton,
  UICard,
  UIChip,
  UIEmptyState,
  UIErrorBanner,
  UINoticeBar,
  UISectionTitle,
  UISegmented,
  UISkeleton,
  UITextInput,
} from '../components/ui';

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
 * Layar Search Partner (SM-06): kartu filter + hasil + pagination.
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
  const [searched, setSearched] = useState(false);

  const locSet = lat.trim() !== '' && lng.trim() !== '';

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
    setSearched(true);
    onSearch({
      ...(sport ? { sport } : {}),
      ...(skill ? { skill } : {}),
      ...(latNum !== undefined ? { lat: latNum, lng: lngNum as number, radius: Math.round(radiusNum) } : {}),
      page: 1,
      limit,
    });
  };

  return (
    <View style={styles.screen}>
      <View style={styles.padded}>
        <UIAppBar title="Cari Partner" />
      </View>
      {loading && partners.length === 0 && searched ? (
        <View style={styles.padded}>
          <UISkeleton rows={3} />
        </View>
      ) : (
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={partners}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View>
              <UICard>
                <UISectionTitle>Filter</UISectionTitle>
                <Text style={styles.label}>Olahraga</Text>
                <View style={styles.chips}>
                  <UIChip label="Semua" active={!sport} onPress={() => setSport(null)} />
                  {SPORT_SUGGESTIONS.map((s) => {
                    const active = sport?.toLowerCase() === s.toLowerCase();
                    return (
                      <UIChip key={s} label={s} active={active} onPress={() => setSport(active ? null : s)} />
                    );
                  })}
                </View>

                <Text style={styles.label}>Skill</Text>
                <UISegmented<SkillLevel>
                  label="Skill partner"
                  value={skill}
                  onChange={setSkill}
                  options={[
                    { value: null, label: 'Semua' },
                    { value: 'beginner', label: SKILL_LABELS.beginner },
                    { value: 'intermediate', label: SKILL_LABELS.intermediate },
                    { value: 'advanced', label: SKILL_LABELS.advanced },
                  ]}
                />

                <Text style={styles.label}>Jarak</Text>
                <View style={styles.chips}>
                  {RADIUS_PRESETS.map((r) => {
                    const active = Number(radius) === r;
                    return (
                      <UIChip
                        key={r}
                        label={r >= 1000 ? `${r / 1000} km` : `${r} m`}
                        active={active}
                        onPress={() => setRadius(String(r))}
                        accessibilityLabel={`Jarak ${r >= 1000 ? `${r / 1000} kilometer` : `${r} meter`}`}
                      />
                    );
                  })}
                </View>
                <UITextInput
                  label="Radius manual (meter)"
                  testID="partner-radius"
                  placeholder="100..100000"
                  keyboardType="numbers-and-punctuation"
                  value={radius}
                  onChangeText={setRadius}
                />

                <Text style={styles.label}>Lokasi</Text>
                <Text style={styles.gpsStatus} accessibilityLabel={locSet ? 'Lokasi sudah ditandai' : 'Lokasi belum ditandai'}>
                  {locSet ? '✓ Lokasi sudah ditandai' : '📍 Lokasi belum ditandai — pakai GPS biar akurat'}
                </Text>
                {gpsLoading ? (
                  <ActivityIndicator accessibilityLabel="Mencari lokasi GPS" />
                ) : (
                  <UIButton title="📍 Pakai GPS" variant="outline" onPress={useGps} accessibilityLabel="Tandai lokasi via GPS" />
                )}
                {gpsError ? <Text style={styles.inlineError}>⚠ {gpsError}</Text> : null}
                <View style={styles.row}>
                  <View style={styles.flex}>
                    <UITextInput
                      label="Lat"
                      testID="partner-lat"
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
                      testID="partner-lng"
                      placeholder="106,8"
                      keyboardType="numbers-and-punctuation"
                      value={lng}
                      onChangeText={setLng}
                    />
                  </View>
                </View>

                {localError ? <Text style={styles.inlineError}>⚠ {localError}</Text> : null}
                <View style={styles.gap} />
                <UIButton
                  title="Cari Partner"
                  onPress={submit}
                  loading={loading && partners.length === 0}
                  loadingTitle="Mencari…"
                  accessibilityLabel="Cari partner sparing"
                />
              </UICard>

              <UIErrorBanner message={friendlyServerError(error)} actionLabel="Coba lagi" onAction={submit} />
              <UINoticeBar message={notice} />

              <Text style={styles.meta} accessibilityRole="text">
                {total > 0 ? `${total} partner • hal ${page}` : searched ? 'Tidak ada partner cocok.' : 'Atur filter lalu tekan Cari.'}
              </Text>
            </View>
          }
          ListEmptyComponent={
            loading ? null : (
              <UIEmptyState
                illustration={searched ? '🔍' : '🤝'}
                title={searched ? 'Tidak ada yang cocok' : 'Cari kawan sparing'}
                message={
                  searched
                    ? 'Coba longgarkan filter atau perlebar jarak pencarianmu.'
                    : 'Atur olahraga, skill, dan jarak, lalu tekan Cari.'
                }
              />
            )
          }
          renderItem={({ item }) => {
            const name = item.displayName || item.email;
            const sports = (item.sports ?? []).slice(0, 3);
            return (
              <View style={styles.card} accessibilityLabel={`Partner ${name}`}>
                <View style={styles.cardTop}>
                  <UIAvatar name={item.displayName} email={item.email} uri={item.avatarUrl} size={44} />
                  <View style={styles.cardHead}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {name}
                    </Text>
                    <View style={styles.chips}>
                      {sports.map((s) => (
                        <View key={s} style={styles.miniChip}>
                          <Text style={styles.miniChipText}>{s}</Text>
                        </View>
                      ))}
                      {item.skillLevel ? (
                        <UIBadge kind="skill" label={SKILL_LABELS[item.skillLevel]} icon="★" />
                      ) : null}
                    </View>
                  </View>
                </View>
                <Text style={styles.cardSub}>
                  {item.distanceMeters != null ? `📍 ${formatDistance(item.distanceMeters)}` : '📍 Jarak —'}
                </Text>
                <View style={styles.cardRow}>
                  <View style={styles.flex}>
                    <UIButton title="Sapa 👋" onPress={() => onChat(item)} accessibilityLabel={`Sapa ${name}`} />
                  </View>
                  <View style={styles.gapH} />
                  <View style={styles.flex}>
                    <UIButton title="Undang" variant="outline" onPress={() => onInvite(item)} accessibilityLabel={`Undang ${name}`} />
                  </View>
                </View>
              </View>
            );
          }}
          ListFooterComponent={
            hasMore ? (
              <View style={styles.footer}>
                <UIButton
                  title={loading ? 'Memuat…' : 'Muat lagi'}
                  variant="ghost"
                  onPress={onLoadMore}
                  disabled={loading}
                  accessibilityLabel="Muat partner berikutnya"
                />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  padded: { paddingHorizontal: SPACING.screen, paddingTop: SPACING.screen },
  list: { flex: 1 },
  listContent: { paddingHorizontal: SPACING.screen, paddingBottom: SPACING.screen },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.ink, marginTop: SPACING.md, marginBottom: SPACING.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  flex: { flex: 1 },
  gap: { height: SPACING.sm },
  gapH: { width: SPACING.sm },
  gpsStatus: { fontSize: 13, color: COLORS.muted, marginBottom: SPACING.sm },
  inlineError: { fontSize: 13, color: COLORS.danger, marginTop: SPACING.xs },
  meta: { fontSize: 13, color: COLORS.muted, marginTop: SPACING.md, marginBottom: SPACING.sm, textAlign: 'center' },
  card: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 20,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  cardHead: { flex: 1, marginLeft: SPACING.md },
  cardTitle: { ...TYPO.cardTitle, color: COLORS.ink },
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
  cardSub: { fontSize: 13, color: COLORS.muted, marginTop: SPACING.sm },
  cardRow: { flexDirection: 'row', marginTop: SPACING.md },
  footer: { marginTop: SPACING.sm },
});
