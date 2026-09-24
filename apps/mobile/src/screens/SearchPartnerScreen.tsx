import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
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
import { COLORS, RADIUS, SPACING, TYPO, friendlyServerError } from '../theme';
import {
  UIAvatar,
  UIBadge,
  UIButton,
  UICard,
  UIChip,
  UIEmptyState,
  UIErrorBanner,
  UIHeader,
  UINoticeBar,
  UISearchBar,
  UISegmented,
  UISkeleton,
  UISportChips,
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
  /** GAP-01: kirim invite real (induk menangani POST /invites + feedback). */
  onInvite: (partner: PartnerItem) => void;
  onChat: (partner: PartnerItem) => void;
  /** GAP-01: bell -> kotak masuk notifikasi (ganti Alert GAP-01). */
  onBellPress?: () => void;
  /** Id partner yang undangannya sedang dikirim (tombol Ajak dinonaktifkan). */
  invitingId?: string | null;
  /** Buka layar Undangan Sparing (masuk/keluar + terima/tolak). */
  onOpenInvites?: () => void;
  /** Jumlah undangan masuk pending (badge display-only). */
  pendingInvites?: number;
}

/**
 * Layar Search Partner (SM-06): kartu filter + hasil + pagination.
 * Restyle Stitch "Kawan di Sekitarmu": header navy, judul + pill online,
 * search bar + chip aktif horizontal, banner radar, kartu partner real-only.
 * Logic pencarian, validasi, pagination, GPS, Sapa/Chat/Invite IDENTIK.
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
  onBellPress,
  invitingId,
  onOpenInvites,
  pendingInvites,
}: Props) {
  const [sport, setSport] = useState<string | null>(null);
  const [skill, setSkill] = useState<SkillLevel | null>(null);
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [radius, setRadius] = useState('10000');
  const [localError, setLocalError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  // UI-only: kata kunci saring hasil yg sudah ada (nama/cabor), buka-tutup filter.
  const [query, setQuery] = useState('');
  const [showFilter, setShowFilter] = useState(true);
  // UI-only: input radius manual disembunyikan di balik toggle advanced
  // (collapsed default); nilai tetap terkirim seperti sekarang.
  const [showRadiusManual, setShowRadiusManual] = useState(false);

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
    setShowFilter(false);
    onSearch({
      ...(sport ? { sport } : {}),
      ...(skill ? { skill } : {}),
      ...(latNum !== undefined ? { lat: latNum, lng: lngNum as number, radius: Math.round(radiusNum) } : {}),
      page: 1,
      limit,
    });
  };

  // Saring client-side dari hasil real: nama/email + cabor yg ikut hasil.
  const q = query.trim().toLowerCase();
  const visible = q
    ? partners.filter((p) => {
        const hay = `${p.displayName ?? ''} ${p.email ?? ''} ${(p.sports ?? []).join(' ')}`.toLowerCase();
        return hay.includes(q);
      })
    : partners;

  const radiusNum = Number(radius);
  const radiusLabel = Number.isFinite(radiusNum) && radiusNum > 0 ? formatDistance(radiusNum) : 'Jarak —';

  return (
    <View style={styles.screen}>
      <UIHeader locationText={locSet ? 'Sekitarmu' : 'Pilih lokasi'} onBellPress={onBellPress} />

      {loading && partners.length === 0 && searched ? (
        <View style={styles.padded}>
          <UISkeleton rows={3} />
        </View>
      ) : (
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={visible}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View>
              {/* Blok judul */}
              <View style={styles.titleRow}>
                <View style={styles.titleCol}>
                  <Text style={styles.eyebrow}>TEMAN MAIN & SPARRING</Text>
                  <Text style={styles.title}>Kawan di Sekitarmu</Text>
                </View>
                {searched ? (
                  <View style={styles.onlinePill} accessibilityLabel={`${partners.length} partner online`}>
                    <View style={styles.onlineDot} accessibilityElementsHidden />
                    <Text style={styles.onlineText}>{partners.length} Online</Text>
                  </View>
                ) : null}
              </View>
              {onOpenInvites ? (
                <View style={styles.inviteRow}>
                  <UIButton
                    title={
                      pendingInvites && pendingInvites > 0
                        ? `📩 Undangan (${pendingInvites})`
                        : '📩 Undangan Sparing'
                    }
                    variant="outline"
                    onPress={onOpenInvites}
                    accessibilityLabel="Buka undangan sparing masuk dan keluar"
                  />
                </View>
              ) : null}

              {/* Search bar + tombol filter */}
              <UISearchBar
                value={query}
                onChange={setQuery}
                placeholder="Cari nama, cabor, atau lokasi…"
                accessibilityLabel="Cari partner berdasarkan nama atau cabor"
                onFilterPress={() => setShowFilter((v) => !v)}
                filterExpanded={showFilter}
              />

              {/* Chip filter AKTIF — horizontal scroll */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipStrip}
                accessibilityLabel="Filter yang sedang aktif"
              >
                <View style={styles.chipDark} accessibilityLabel={`Jarak ${radiusLabel}`}>
                  <View style={styles.chipDot} accessibilityElementsHidden />
                  <Text style={styles.chipDarkText}>📍 {radiusLabel}</Text>
                </View>
                {sport ? (
                  <TouchableOpacity
                    style={styles.chipLight}
                    onPress={() => setSport(null)}
                    accessibilityRole="button"
                    accessibilityLabel={`Hapus filter cabor ${sport}`}
                  >
                    <Text style={styles.chipLightText}>{sport} ×</Text>
                  </TouchableOpacity>
                ) : null}
                {skill ? (
                  <TouchableOpacity
                    style={styles.chipLight}
                    onPress={() => setSkill(null)}
                    accessibilityRole="button"
                    accessibilityLabel={`Hapus filter skill ${SKILL_LABELS[skill]}`}
                  >
                    <Text style={styles.chipLightText}>⚡ {SKILL_LABELS[skill]} ×</Text>
                  </TouchableOpacity>
                ) : null}
              </ScrollView>

              {/* Form filter lengkap (collapsible) — state/handler tetap */}
              {showFilter ? (
                <UICard>
                  <Text style={styles.label}>Olahraga</Text>
                  <UISportChips sports={SPORT_SUGGESTIONS} value={sport} onChange={setSport} />

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
                  <TouchableOpacity
                    style={styles.radiusToggle}
                    onPress={() => setShowRadiusManual((v) => !v)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: showRadiusManual }}
                    accessibilityLabel="Tampilkan pengaturan radius manual"
                  >
                    <Text style={styles.radiusToggleText}>
                      {showRadiusManual ? '▾' : '▸'} Radius manual
                    </Text>
                  </TouchableOpacity>
                  {showRadiusManual ? (
                    <UITextInput
                      label="Radius manual (meter)"
                      testID="partner-radius"
                      placeholder="100..100000"
                      keyboardType="numbers-and-punctuation"
                      value={radius}
                      onChangeText={setRadius}
                    />
                  ) : null}

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
              ) : null}

              {/* Banner Radar — hanya bila ada hasil real */}
              {searched && partners.length > 0 ? (
                <View style={styles.radar} accessibilityLabel={`${partners.length} partner siap mabar di sekitarmu`}>
                  <View style={styles.radarIcon} accessibilityElementsHidden>
                    <Text style={styles.radarIconText}>📡</Text>
                  </View>
                  <View style={styles.radarCol}>
                    <Text style={styles.radarTitle}>Radar Sparing Aktif</Text>
                    <Text style={styles.radarSub}>
                      {partners.length} partner siap mabar di lapangan Terdekat!
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.radarBtn}
                    onPress={submit}
                    accessibilityRole="button"
                    accessibilityLabel="Pindai ulang radar sparing"
                  >
                    <Text style={styles.radarBtnText}>RADAR</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

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
            const matchSport = !!sport && sports.some((s) => s.toLowerCase() === sport.toLowerCase());
            const matchSkill = !!skill && item.skillLevel === skill;
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
                  {matchSport || matchSkill ? (
                    <View style={styles.matchBadge} accessibilityLabel="Cocok dengan filtermu">
                      <Text style={styles.matchBadgeText}>✓ Cocok</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.cardSub}>
                  {item.distanceMeters != null ? `📍 ${formatDistance(item.distanceMeters)}` : '📍 Jarak —'}
                </Text>
                <View style={styles.cardRow}>
                  <View style={styles.flex}>
                    <UIButton
                      title={invitingId === item.id ? 'Mengundang…' : 'Ajak Main'}
                      variant="accent"
                      onPress={() => onInvite(item)}
                      disabled={invitingId === item.id}
                      accessibilityLabel={`Ajak main ${name}`}
                    />
                  </View>
                  <View style={styles.gapH} />
                  <View style={styles.flex}>
                    <UIButton title="Chat" variant="primary" onPress={() => onChat(item)} accessibilityLabel={`Chat dengan ${name}`} />
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
  screen: { flex: 1, backgroundColor: COLORS.bgAlt },
  padded: { paddingHorizontal: SPACING.screen, paddingTop: SPACING.screen },
  list: { flex: 1 },
  listContent: { paddingHorizontal: SPACING.screen, paddingBottom: SPACING.screen + 96 },
  inviteRow: { marginTop: SPACING.sm },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingTop: SPACING.md,
  },
  titleCol: { flex: 1, marginRight: SPACING.sm },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: COLORS.navy },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.ink, marginTop: 2 },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
  },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.brand600, marginRight: 6 },
  onlineText: { fontSize: 12, fontWeight: '700', color: COLORS.brand700 },
  chipStrip: { marginVertical: SPACING.sm, gap: SPACING.sm, alignItems: 'center' },
  chipDark: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.navy,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    marginRight: SPACING.sm,
  },
  chipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.lime, marginRight: 6 },
  chipDarkText: { fontSize: 13, fontWeight: '700', color: COLORS.bg },
  chipLight: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    marginRight: SPACING.sm,
  },
  chipLightText: { fontSize: 13, fontWeight: '700', color: COLORS.ink },
  radar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.brand900,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  radarIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarIconText: { fontSize: 22 },
  radarCol: { flex: 1, marginHorizontal: SPACING.sm },
  radarTitle: { fontSize: 14, fontWeight: '800', color: COLORS.bg },
  radarSub: { fontSize: 12, color: COLORS.bg, opacity: 0.85, marginTop: 2 },
  radarBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
  },
  radarBtnText: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: COLORS.bg },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.ink, marginTop: SPACING.md, marginBottom: SPACING.sm },
  radiusToggle: { paddingVertical: SPACING.sm, marginTop: SPACING.sm, alignSelf: 'flex-start' },
  radiusToggleText: { fontSize: 14, fontWeight: '700', color: COLORS.brand700 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  flex: { flex: 1, minWidth: 0, flexShrink: 1 },
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
  matchBadge: {
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.brand100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: SPACING.sm,
  },
  matchBadgeText: { fontSize: 12, fontWeight: '800', color: COLORS.brand900 },
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
