/**
 * Komponen bersama Design System v1 (UX-02): Button, Card, Chip,
 * TextInput berlabel, EmptyState, Skeleton, Badge, Avatar, Segmented,
 * AppBar, banner, Toast. Dipakai ulang antar layar batch UX-02.
 * JANGAN dipakai untuk refactor komponen rating (di luar scope).
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from 'react-native';
import { COLORS, RADIUS, SPACING, TYPO, initialsOf } from '../theme';

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

export type BadgeKind = 'open' | 'full' | 'paid' | 'pending' | 'expired' | 'unread' | 'skill' | 'info';

const BADGE_STYLE: Record<BadgeKind, { bg: string; fg: string }> = {
  open: { bg: COLORS.brand100, fg: COLORS.brand900 },
  full: { bg: COLORS.fullBg, fg: COLORS.fullFg },
  paid: { bg: COLORS.tealPaidBg, fg: COLORS.tealPaid },
  pending: { bg: COLORS.pendingBg, fg: COLORS.pendingFg },
  expired: { bg: COLORS.expiredBg, fg: COLORS.expiredFg },
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

// ---------- Styles ----------

const styles = StyleSheet.create({
  btn: {
    minHeight: 48,
    borderRadius: RADIUS.md,
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
    marginRight: SPACING.sm,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.bg,
  },
  chipActive: { backgroundColor: COLORS.brand700, borderColor: COLORS.brand700 },
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
    marginRight: SPACING.sm,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.bg,
  },
  segActive: { backgroundColor: COLORS.brand700, borderColor: COLORS.brand700 },
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
});
