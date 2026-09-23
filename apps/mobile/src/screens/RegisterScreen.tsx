import React, { useRef, useState } from 'react';
import { Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { COLORS, SPACING, TYPO, friendlyServerError } from '../theme';
import { UIButton, UIErrorBanner, UITextInput } from '../components/ui';

// Logo K in-app (disalin dari docs/design/k-logo-192.png).
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const K_LOGO = require('../assets/k-logo.png');

interface Props {
  loading: boolean;
  serverError: string | null;
  onSubmit: (email: string, password: string, displayName?: string) => void;
  onSwitch: () => void;
  initialEmail?: string;
  onEmailChange?: (email: string) => void;
}

function isEmailFormat(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

type Strength = 'Lemah' | 'Cukup' | 'Kuat';

function strengthOf(pw: string): Strength | null {
  if (!pw) return null;
  const hasLetter = /[a-zA-Z]/.test(pw);
  const hasDigit = /\d/.test(pw);
  if (pw.length >= 12 && hasLetter && hasDigit) return 'Kuat';
  if (pw.length >= 8 && hasLetter && hasDigit) return 'Cukup';
  return 'Lemah';
}

export function RegisterScreen({ loading, serverError, onSubmit, onSwitch, initialEmail, onEmailChange }: Props) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState(initialEmail ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const strength = strengthOf(password);
  const ruleLength = password.length >= 8;
  const ruleAlnum = /[a-zA-Z]/.test(password) && /\d/.test(password);
  const ruleMatch = confirm.length > 0 && confirm === password;

  const changeEmail = (v: string) => {
    setEmail(v);
    onEmailChange?.(v);
    if (emailError) setEmailError(null);
  };

  const submit = () => {
    let ok = true;
    if (!email.trim()) {
      setEmailError('Email wajib diisi');
      ok = false;
    } else if (!isEmailFormat(email.trim())) {
      setEmailError('Format email tidak valid');
      ok = false;
    }
    if (!ruleLength) {
      setPasswordError('Minimal 8 karakter');
      ok = false;
    } else if (!ruleAlnum) {
      setPasswordError('Perlu ada huruf dan angka');
      ok = false;
    }
    if (confirm !== password) {
      setConfirmError('Konfirmasi belum sama');
      ok = false;
    }
    if (!ok) return;
    setEmailError(null);
    setPasswordError(null);
    setConfirmError(null);
    onSubmit(email.trim(), password, displayName.trim() || undefined);
  };

  return (
    <View style={styles.content}>
      <View style={styles.hero} accessibilityRole="header">
        <Image source={K_LOGO} style={styles.logoImg} accessibilityLabel="Logo KawanSport" />
        <View style={styles.badgePill} accessibilityLabel="Main bareng, naik level">
          <Text style={styles.badgePillText}>🏸 Main bareng, naik level</Text>
        </View>
        <Text style={styles.heroTitle}>Buat Akun</Text>
        <Text style={styles.heroSub}>Kenalan dulu, biar gampang diajak sparing</Text>
      </View>

      <UIErrorBanner message={friendlyServerError(serverError)} />

      <UITextInput
        label="Nama tampilan (opsional)"
        testID="register-name"
        placeholder="cth. Andi"
        returnKeyType="next"
        autoFocus
        value={displayName}
        onChangeText={setDisplayName}
        onSubmitEditing={() => emailRef.current?.focus()}
      />
      <UITextInput
        label="Email"
        testID="register-email"
        placeholder="nama@email.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        returnKeyType="next"
        value={email}
        onChangeText={changeEmail}
        onBlur={() => {
          if (email.trim() && !isEmailFormat(email.trim())) setEmailError('Format email tidak valid');
        }}
        onSubmitEditing={() => passwordRef.current?.focus()}
        error={emailError}
        ref={emailRef}
      />
      <UITextInput
        label="Password"
        testID="register-password"
        placeholder="Minimal 8 karakter, ada huruf + angka"
        secureTextEntry={!showPassword}
        returnKeyType="next"
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          if (passwordError) setPasswordError(null);
        }}
        onSubmitEditing={() => confirmRef.current?.focus()}
        error={passwordError}
        ref={passwordRef}
        right={
          <TouchableOpacity
            onPress={() => setShowPassword((s) => !s)}
            style={styles.peek}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
          >
            <Text style={styles.peekText}>{showPassword ? 'Sembunyi' : 'Lihat'}</Text>
          </TouchableOpacity>
        }
      />

      {strength ? (
        <View style={styles.meter} accessibilityLabel={`Kekuatan sandi: ${strength}`}>
          <View style={styles.meterBar}>
            <View
              style={[
                styles.meterFill,
                strength === 'Lemah' && styles.meterWeak,
                strength === 'Cukup' && styles.meterFair,
                strength === 'Kuat' && styles.meterStrong,
              ]}
            />
          </View>
          <Text style={styles.meterLabel}>🛡 {strength}</Text>
        </View>
      ) : null}

      <UITextInput
        label="Ulasan password"
        testID="register-confirm"
        placeholder="Ketik ulang password"
        secureTextEntry={!showPassword}
        returnKeyType="done"
        value={confirm}
        onChangeText={(v) => {
          setConfirm(v);
          if (confirmError) setConfirmError(null);
        }}
        onSubmitEditing={submit}
        error={confirmError}
        ref={confirmRef}
      />

      <View style={styles.rules} accessibilityLabel="Aturan password">
        <Text style={[styles.rule, ruleLength && styles.ruleOk]}>{ruleLength ? '✓' : '•'} Minimal 8 karakter</Text>
        <Text style={[styles.rule, ruleAlnum && styles.ruleOk]}>{ruleAlnum ? '✓' : '•'} Ada huruf dan angka</Text>
        <Text style={[styles.rule, ruleMatch && styles.ruleOk]}>{ruleMatch ? '✓' : '•'} Konfirmasi sama</Text>
      </View>

      <View style={styles.gap} />
      <UIButton
        title="Daftar"
        variant="accent"
        onPress={submit}
        loading={loading}
        loadingTitle="Memproses pendaftaran…"
        accessibilityLabel="Tombol Daftar"
        testID="register-submit"
      />
      <View style={styles.gap} />
      <UIButton
        title="Sudah Punya Akun? Masuk"
        variant="ghost"
        onPress={onSwitch}
        accessibilityLabel="Beralih ke masuk"
      />
      <Text style={styles.terms}>
        Dengan daftar, kamu menyetujui Kode Etik Sportivitas & Aturan Privasi KawanSport.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: SPACING.screen },
  hero: { alignItems: 'center', marginBottom: SPACING.lg },
  logoImg: {
    width: 56,
    height: 56,
    borderRadius: 16,
    marginBottom: SPACING.sm,
  },
  badgePill: {
    backgroundColor: COLORS.navy,
    borderRadius: 9999,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  badgePillText: { color: COLORS.bg, fontSize: 12, fontWeight: '700' },
  heroTitle: { ...TYPO.title, color: COLORS.ink },
  heroSub: { fontSize: 14, color: COLORS.muted, marginTop: SPACING.xs, textAlign: 'center' },
  peek: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' },
  peekText: { fontSize: 14, fontWeight: '700', color: COLORS.brand700 },
  meter: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
  meterBar: { flex: 1, height: 8, borderRadius: 4, backgroundColor: COLORS.line, overflow: 'hidden' },
  meterFill: { height: 8, borderRadius: 4, width: '100%' },
  meterWeak: { backgroundColor: COLORS.danger, width: '33%' },
  meterFair: { backgroundColor: COLORS.star, width: '66%' },
  meterStrong: { backgroundColor: COLORS.brand600, width: '100%' },
  meterLabel: { fontSize: 13, fontWeight: '700', color: COLORS.muted, marginLeft: SPACING.sm, minWidth: 48 },
  rules: { marginBottom: SPACING.sm },
  rule: { fontSize: 13, color: COLORS.muted, marginTop: SPACING.xs },
  ruleOk: { color: COLORS.brand700, fontWeight: '700' },
  gap: { height: SPACING.md },
  terms: { fontSize: 12, color: COLORS.faint, textAlign: 'center', marginTop: SPACING.md, lineHeight: 18 },
});
