/**
 * Komponen bersama Design System v1 (UX-02) + varian Stitch UX-03:
 * Button pill, Card, Chip navy + dot lime, TextInput berlabel, EmptyState,
 * Skeleton, Badge, Avatar, Segmented navy, AppBar, banner, Toast,
 * SearchBar, ProgressBar, StickyBar. Dipakai ulang antar layar.
 * JANGAN dipakai untuk refactor komponen rating (di luar scope).
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from 'react-native';
import { COLORS, RADIUS, SPACING, TYPO, initialsOf } from '../theme';

// Logo resmi KawanSport (src/assets/logo.png — master: docs/design/logo.png).
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const HEADER_LOGO = require('../assets/logo.png');

// ---------- Button ----------

type ButtonVariant = 'primary' | 'accent' | 'outline' | 'ghost' | 'danger';

interface UIButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  loadingTitle?: string;
  accessibilityLabel?: string;
  testID?: string;
  /** Override gaya tombol khusus (mis. FAB kompak) — default stretch penuh. */
  style?: object;
  /** Override gaya teks tombol khusus (mis. samakan label Stitch). */
  textStyle?: object;
}

export function UIButton({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  loadingTitle,
  accessibilityLabel,
  testID,
  style,
  textStyle,
}: UIButtonProps) {
  const inactive = disabled || loading;
  return (
    <TouchableOpacity
      style={[
        styles.btn,
        variant === 'primary' && styles.btnPrimary,
        variant === 'accent' && styles.btnAccent,
        variant === 'outline' && styles.btnOutline,
        variant === 'ghost' && styles.btnGhost,
        variant === 'danger' && styles.btnDanger,
        inactive && styles.btnDisabled,
        style,
      ]}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      testID={testID}
    >
      {loading ? (
        <View style={styles.btnLoadingRow}>
          <ActivityIndicator
            size="small"
            color={variant === 'outline' || variant === 'ghost' ? COLORS.brand700 : COLORS.bg}
          />
          <Text
            style={[
              styles.btnText,
              variant === 'outline' && styles.btnTextOutline,
              variant === 'ghost' && styles.btnTextGhost,
              textStyle,
            ]}
          >
            {loadingTitle ?? title}
          </Text>
        </View>
      ) : (
        <Text
          style={[
            styles.btnText,
            variant === 'outline' && styles.btnTextOutline,
            variant === 'ghost' && styles.btnTextGhost,
            textStyle,
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

// ---------- Card ----------

export function UICard({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

// ---------- Chip ----------

interface UIChipProps {
  label: string;
  active?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}

export function UIChip({ label, active, onPress, accessibilityLabel }: UIChipProps) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `Saring ${label}`}
      accessibilityState={{ selected: !!active }}
    >
      {active ? <View style={styles.chipDot} accessibilityElementsHidden /> : null}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ---------- TextInput berlabel ----------

interface UITextInputProps extends TextInputProps {
  label: string;
  error?: string | null;
  right?: React.ReactNode;
}

export const UITextInput = React.forwardRef<TextInput, UITextInputProps>(function UITextInput(
  { label, error, right, style, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel} nativeID={`${rest.testID ?? label}-label`}>
        {label}
      </Text>
      <View
        style={[
          styles.inputWrap,
          focused && styles.inputWrapFocused,
          error ? styles.inputWrapError : null,
        ]}
      >
        <TextInput
          ref={ref}
          style={[styles.input, style]}
          placeholderTextColor={COLORS.faint}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          accessibilityLabel={label}
          {...rest}
        />
        {right ? <View style={styles.inputRight}>{right}</View> : null}
      </View>
      {error ? (
        <Text style={styles.fieldError} accessibilityRole="alert">
          ⚠ {error}
        </Text>
      ) : null}
    </View>
  );
});

// ---------- Banner error / notice ----------

export function UIErrorBanner({
  message,
  actionLabel,
  onAction,
}: {
  message: string | null;
  actionLabel?: string;
  onAction?: () => void;
}) {
  if (!message) return null;
  return (
    <View style={styles.errorBanner} accessibilityRole="alert">
      <Text style={styles.errorBannerText}>⚠ {message}</Text>
      {actionLabel && onAction ? (
        <TouchableOpacity
          onPress={onAction}
          style={styles.errorBannerBtn}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={styles.errorBannerBtnText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function UINoticeBar({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.noticeBar}>
      <Text style={styles.noticeBarText}>ℹ {message}</Text>
    </View>
  );
}

// ---------- EmptyState ----------

export function UIEmptyState({
  illustration,
  title,
  message,
  actionLabel,
  onAction,
  actionA11y,
}: {
  illustration: string;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  actionA11y?: string;
}) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyArt} accessibilityElementsHidden>
        {illustration}
      </Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMsg}>{message}</Text>
      {actionLabel && onAction ? (
        <View style={styles.emptyCta}>
          <UIButton title={actionLabel} onPress={onAction} accessibilityLabel={actionA11y ?? actionLabel} />
        </View>
      ) : null}
    </View>
  );
}

// ---------- Skeleton ----------

export function UISkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <View accessibilityLabel="Memuat konten">
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={styles.skeletonCard}>
          <View style={styles.skeletonLineWide} />
          <View style={styles.skeletonLine} />
          <View style={styles.skeletonLineShort} />
        </View>
      ))}
    </View>
  );
}

// ---------- Badge ----------

export type BadgeKind =
  | 'open'
  | 'full'
  | 'paid'
  | 'pending'
  | 'expired'
  | 'cancelled'
  | 'unread'
  | 'skill'
  | 'info';

const BADGE_STYLE: Record<BadgeKind, { bg: string; fg: string }> = {
  open: { bg: COLORS.brand100, fg: COLORS.brand900 },
  full: { bg: COLORS.fullBg, fg: COLORS.fullFg },
  paid: { bg: COLORS.tealPaidBg, fg: COLORS.tealPaid },
  pending: { bg: COLORS.pendingBg, fg: COLORS.pendingFg },
  expired: { bg: COLORS.expiredBg, fg: COLORS.expiredFg },
  cancelled: { bg: COLORS.dangerSoft, fg: COLORS.danger },
  unread: { bg: COLORS.danger, fg: COLORS.bg },
  skill: { bg: COLORS.brand100, fg: COLORS.brand900 },
  info: { bg: COLORS.brand100, fg: COLORS.brand900 },
};

export function UIBadge({ kind, label, icon }: { kind: BadgeKind; label: string; icon?: string }) {
  const s = BADGE_STYLE[kind];
  return (
    <View
      style={[styles.badge, { backgroundColor: s.bg }]}
      accessibilityLabel={`Status: ${label}`}
      accessibilityRole="text"
    >
      <Text style={[styles.badgeText, { color: s.fg }]}>
        {icon ? `${icon} ` : ''}
        {label}
      </Text>
    </View>
  );
}

// ---------- Avatar ----------

export function UIAvatar({
  name,
  email,
  uri,
  size = 44,
}: {
  name?: string | null;
  email?: string;
  uri?: string | null;
  size?: 36 | 44 | 64;
}) {
  const label = `Foto ${name || email || 'pengguna'}`;
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
        accessibilityLabel={label}
      />
    );
  }
  return (
    <View
      style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}
      accessibilityLabel={label}
      accessibilityRole="image"
    >
      <Text style={[styles.avatarText, { fontSize: size >= 64 ? 22 : 15 }]}>
        {initialsOf(name, email)}
      </Text>
    </View>
  );
}

// ---------- Segmented ----------

interface SegmentedProps<T extends string> {
  label: string;
  options: Array<{ value: T | null; label: string }>;
  value: T | null;
  onChange: (v: T | null) => void;
}

export function UISegmented<T extends string>({ label, options, value, onChange }: SegmentedProps<T>) {
  return (
    <View style={styles.segWrap} accessibilityLabel={label} accessibilityRole="radiogroup">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <TouchableOpacity
            key={o.label}
            style={[styles.seg, active && styles.segActive]}
            onPress={() => onChange(active && o.value !== null ? null : o.value)}
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${o.label}`}
            accessibilityState={{ selected: active }}
          >
            {active ? <View style={styles.chipDot} accessibilityElementsHidden /> : null}
            <Text style={[styles.segText, active && styles.segTextActive]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ---------- AppBar ----------

export function UIAppBar({
  title,
  onBack,
  backLabel = 'Kembali',
  right,
}: {
  title: string;
  onBack?: () => void;
  backLabel?: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.appbar}>
      {onBack ? (
        <TouchableOpacity
          onPress={onBack}
          style={styles.appbarBack}
          accessibilityRole="button"
          accessibilityLabel={backLabel}
        >
          <Text style={styles.appbarBackText}>‹ {backLabel}</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.appbarBack} />
      )}
      <Text style={styles.appbarTitle}>{title}</Text>
      <View style={styles.appbarRight}>{right}</View>
    </View>
  );
}

// ---------- Section ----------

export function UISectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.section}>{children}</Text>;
}

// ---------- Toast ----------

export function UIToast({ message, kind = 'success' }: { message: string | null; kind?: 'success' | 'info' | 'error' }) {
  if (!message) return null;
  return (
    <View
      style={[
        styles.toast,
        kind === 'success' && styles.toastSuccess,
        kind === 'info' && styles.toastInfo,
        kind === 'error' && styles.toastError,
      ]}
      accessibilityRole="alert"
    >
      <Text style={styles.toastText}>
        {kind === 'success' ? '✓ ' : kind === 'info' ? 'ℹ ' : '⚠ '}
        {message}
      </Text>
    </View>
  );
}

// ---------- Search bar (Stitch UX-03) ----------

export function UISearchBar({
  value,
  onChange,
  placeholder = 'Cari...',
  accessibilityLabel = 'Pencarian',
  onFilterPress,
  filterExpanded,
  filterLabel = 'Filter pencarian',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  accessibilityLabel?: string;
  onFilterPress?: () => void;
  filterExpanded?: boolean;
  filterLabel?: string;
}) {
  return (
    <View style={styles.searchRow}>
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon} accessibilityElementsHidden>
          🔍
        </Text>
        <TextInput
          style={styles.searchInput}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={COLORS.faint}
          accessibilityLabel={accessibilityLabel}
          returnKeyType="search"
        />
      </View>
      {onFilterPress ? (
        <TouchableOpacity
          style={styles.searchFilterBtn}
          onPress={onFilterPress}
          accessibilityRole="button"
          accessibilityLabel={filterExpanded ? 'Sembunyikan filter' : filterLabel}
          accessibilityState={filterExpanded !== undefined ? { expanded: filterExpanded } : undefined}
        >
          <Text style={styles.searchFilterIcon} accessibilityElementsHidden>
            ⚙
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ---------- Header navy Stitch (discovery list) ----------

export function UIHeader({
  locationText = 'Sekitarmu',
  onBellPress,
  onAvatarPress,
  userName,
  userEmail,
  avatarUri,
}: {
  locationText?: string;
  onBellPress?: () => void;
  onAvatarPress?: () => void;
  userName?: string | null;
  userEmail?: string;
  avatarUri?: string | null;
}) {
  const locLabel = locationText === 'Pilih lokasi' ? 'Lokasi belum dipilih' : `Lokasi: ${locationText}`;
  const bellInner = (
    <View style={styles.headerBellInner}>
      <Text style={styles.headerBellIcon} accessibilityElementsHidden>
        🔔
      </Text>
      <View style={styles.headerBellDot} accessibilityElementsHidden />
    </View>
  );
  return (
    <View style={styles.header}>
      <View style={styles.headerBrand}>
        <Image
          source={HEADER_LOGO}
          style={styles.headerLogo}
          accessibilityLabel="Logo KawanSport"
          accessibilityElementsHidden
        />
        <View style={styles.headerBrandCol}>
          <Text style={styles.headerName}>KawanSport</Text>
          <Text
            style={styles.headerLoc}
            accessibilityLabel={locLabel}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            📍 {locationText} ▾
          </Text>
        </View>
      </View>
      <View style={styles.headerRight}>
        {/*
          Bell SELALU Touchable agar ada respons sentuh (ripple/opacity).
          Tanpa onBellPress: no-op jujur — tanpa angka palsu & tanpa navigasi
          palsu; label a11y menjelaskan riwayat notifikasi segera hadir.
          (Toast tinggal di flow App.tsx dan tak terjangkau header.)
        */}
        <TouchableOpacity
          style={styles.headerBell}
          onPress={onBellPress ?? (() => undefined)}
          accessibilityRole="button"
          accessibilityLabel={
            onBellPress ? 'Buka notifikasi' : 'Notifikasi push aktif, riwayat notifikasi segera hadir'
          }
        >
          {bellInner}
        </TouchableOpacity>
        {onAvatarPress ? (
          <TouchableOpacity
            onPress={onAvatarPress}
            accessibilityRole="button"
            accessibilityLabel="Buka profil saya"
          >
            <UIAvatar name={userName ?? 'Akun Saya'} email={userEmail} uri={avatarUri} size={36} />
          </TouchableOpacity>
        ) : (
          <View accessibilityLabel="Foto akun saya">
            <UIAvatar name={userName ?? 'Akun Saya'} email={userEmail} uri={avatarUri} size={36} />
          </View>
        )}
      </View>
    </View>
  );
}

// ---------- Chip olahraga horizontal (discovery list) ----------

export function UISportChips({
  sports,
  value,
  onChange,
}: {
  sports: string[];
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.sportStrip}
      accessibilityLabel="Saring olahraga"
    >
      <UIChip label="Semua" active={!value} onPress={() => onChange(null)} />
      {sports.map((s) => {
        const active = value?.toLowerCase() === s.toLowerCase();
        return (
          <UIChip
            key={s}
            label={s}
            active={active}
            onPress={() => onChange(active ? null : s)}
          />
        );
      })}
    </ScrollView>
  );
}

// ---------- Progress bar (Stitch UX-03: countdown checkout) ----------

export function UIProgressBar({ progress }: { progress: number }) {
  const clamped = Math.min(1, Math.max(0, progress));
  return (
    <View style={styles.progressTrack} accessibilityElementsHidden>
      <View style={[styles.progressFill, { flex: clamped }]} />
      <View style={{ flex: 1 - clamped }} />
    </View>
  );
}

// ---------- Sticky bottom bar (Stitch UX-03: total + CTA oranye) ----------

export function UIStickyBar({
  totalLabel,
  totalValue,
  totalSub,
  ctaTitle,
  onCta,
  ctaDisabled,
  ctaLoading,
  ctaA11y,
}: {
  totalLabel: string;
  totalValue: string;
  totalSub?: string | null;
  ctaTitle: string;
  onCta: () => void;
  ctaDisabled?: boolean;
  ctaLoading?: boolean;
  ctaA11y?: string;
}) {
  const inactive = ctaDisabled || ctaLoading;
  return (
    <View style={styles.stickyBar}>
      <View style={styles.stickyTotal}>
        <Text style={styles.stickyLabel}>{totalLabel}</Text>
        <Text style={styles.stickyValue} numberOfLines={1}>
          {totalValue}
        </Text>
        {totalSub ? (
          <Text style={styles.stickySub} numberOfLines={1}>
            {totalSub}
          </Text>
        ) : null}
      </View>
      <TouchableOpacity
        style={[styles.stickyCta, inactive && styles.btnDisabled]}
        onPress={onCta}
        disabled={inactive}
        accessibilityRole="button"
        accessibilityLabel={ctaA11y ?? ctaTitle}
        accessibilityState={{ disabled: !!inactive, busy: !!ctaLoading }}
      >
        {ctaLoading ? (
          <ActivityIndicator size="small" color={COLORS.bg} />
        ) : (
          <Text style={styles.stickyCtaText}>{ctaTitle} ›</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ---------- Styles ----------

const styles = StyleSheet.create({
  btn: {
    minHeight: 48,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  btnPrimary: { backgroundColor: COLORS.brand700 },
  btnAccent: { backgroundColor: COLORS.accent },
  btnOutline: { backgroundColor: COLORS.bg, borderWidth: 1.5, borderColor: COLORS.brand700 },
  btnGhost: { backgroundColor: 'transparent', minHeight: 44 },
  btnDanger: { backgroundColor: COLORS.bg, borderWidth: 1.5, borderColor: COLORS.danger },
  btnDisabled: { opacity: 0.55 },
  btnText: { color: COLORS.bg, fontSize: 15, fontWeight: '700' },
  btnTextOutline: { color: COLORS.brand700 },
  btnTextGhost: { color: COLORS.brand700 },
  btnLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  card: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
  },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    marginRight: SPACING.sm,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.bg,
  },
  chipActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.lime,
    marginRight: 6,
  },
  chipText: { ...TYPO.chip, color: COLORS.muted },
  chipTextActive: { color: COLORS.bg },
  field: { marginBottom: SPACING.md },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: COLORS.ink, marginBottom: 6 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bg,
    minHeight: 48,
  },
  inputWrapFocused: { borderColor: COLORS.brand700, backgroundColor: COLORS.brand100 },
  inputWrapError: { borderColor: COLORS.danger },
  input: { flex: 1, paddingHorizontal: SPACING.md, fontSize: 15, color: COLORS.ink, minHeight: 46 },
  inputRight: { paddingRight: SPACING.md },
  fieldError: { fontSize: 13, color: COLORS.danger, marginTop: SPACING.xs },
  errorBanner: {
    backgroundColor: COLORS.dangerSoft,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  errorBannerText: { fontSize: 14, color: COLORS.danger, fontWeight: '600' },
  errorBannerBtn: { marginTop: SPACING.sm, minHeight: 44, justifyContent: 'center' },
  errorBannerBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.danger },
  noticeBar: { backgroundColor: COLORS.navy, borderRadius: RADIUS.sm, padding: SPACING.md, marginBottom: SPACING.md },
  noticeBarText: { fontSize: 14, color: COLORS.bg, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: SPACING.xl },
  emptyArt: { fontSize: 44, marginBottom: SPACING.md },
  emptyTitle: { ...TYPO.cardTitle, color: COLORS.ink, marginBottom: SPACING.xs, textAlign: 'center' },
  emptyMsg: { fontSize: 14, color: COLORS.muted, textAlign: 'center', lineHeight: 22 },
  emptyCta: { marginTop: SPACING.lg, alignSelf: 'stretch' },
  skeletonCard: {
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.bg,
  },
  skeletonLineWide: { height: 14, borderRadius: 7, backgroundColor: COLORS.line, marginBottom: SPACING.sm },
  skeletonLine: { height: 12, borderRadius: 6, backgroundColor: COLORS.line, marginBottom: SPACING.sm, width: '70%' },
  skeletonLineShort: { height: 12, borderRadius: 6, backgroundColor: COLORS.line, width: '40%' },
  badge: { borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '700' },
  avatar: { backgroundColor: COLORS.line },
  avatarFallback: { backgroundColor: COLORS.brand900, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: COLORS.lime, fontWeight: '800' },
  segWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  seg: {
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    marginRight: SPACING.sm,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.bg,
  },
  segActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  segText: { ...TYPO.chip, color: COLORS.muted },
  segTextActive: { color: COLORS.bg },
  appbar: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
    backgroundColor: COLORS.bg,
    paddingHorizontal: SPACING.screen,
    marginHorizontal: -SPACING.screen,
    marginBottom: SPACING.md,
  },
  appbarBack: { minWidth: 80, minHeight: 44, justifyContent: 'center' },
  appbarBackText: { fontSize: 15, fontWeight: '700', color: COLORS.brand700 },
  appbarTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: COLORS.ink, textAlign: 'center' },
  appbarRight: { minWidth: 80, alignItems: 'flex-end', minHeight: 44, justifyContent: 'center' },
  section: { ...TYPO.section, color: COLORS.ink, marginTop: SPACING.lg, marginBottom: SPACING.sm },
  toast: {
    position: 'absolute',
    left: SPACING.screen,
    right: SPACING.screen,
    bottom: SPACING.screen,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  toastSuccess: { backgroundColor: COLORS.brand700 },
  toastInfo: { backgroundColor: COLORS.navy },
  toastError: { backgroundColor: COLORS.danger },
  toastText: { fontSize: 14, fontWeight: '600', color: COLORS.bg, textAlign: 'center' },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.md },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: RADIUS.full,
    minHeight: 48,
    paddingHorizontal: SPACING.lg,
  },
  searchIcon: { fontSize: 18, marginRight: SPACING.sm },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.ink, minHeight: 46 },
  searchFilterBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginLeft: SPACING.sm,
    backgroundColor: COLORS.bg,
    borderWidth: 1.5,
    borderColor: COLORS.brand700,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchFilterIcon: { fontSize: 20, color: COLORS.brand700 },
  header: {
    backgroundColor: COLORS.navy,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.screen,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  headerBrand: { flexDirection: 'row', alignItems: 'center', flex: 1, minHeight: 40 },
  headerLogo: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  headerBrandCol: { marginLeft: SPACING.sm, flex: 1, justifyContent: 'center' },
  headerName: { fontSize: 16, fontWeight: '800', color: COLORS.bg },
  headerLoc: { fontSize: 12, fontWeight: '600', color: COLORS.bg, opacity: 0.85, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  headerBell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBellInner: { alignItems: 'center', justifyContent: 'center' },
  headerBellIcon: { fontSize: 18 },
  headerBellDot: {
    position: 'absolute',
    top: -2,
    right: -8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.accent,
  },
  sportStrip: { marginVertical: SPACING.sm, alignItems: 'center' },
  progressTrack: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.line,
    overflow: 'hidden',
  },
  progressFill: { backgroundColor: COLORS.accent, borderRadius: 3 },
  stickyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
    paddingHorizontal: SPACING.screen,
    paddingVertical: SPACING.md,
  },
  stickyTotal: { flex: 1, marginRight: SPACING.md },
  stickyLabel: { fontSize: 12, color: COLORS.muted },
  stickyValue: { ...TYPO.angka, color: COLORS.ink },
  stickySub: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  stickyCta: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.full,
    minHeight: 48,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 150,
  },
  stickyCtaText: { color: COLORS.bg, fontSize: 15, fontWeight: '700' },
});
