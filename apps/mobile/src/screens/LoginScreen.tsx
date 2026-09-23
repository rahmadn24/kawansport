import React, { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { COLORS, SPACING, TYPO, friendlyServerError } from '../theme';
import { UIButton, UIErrorBanner, UITextInput } from '../components/ui';

interface Props {
  loading: boolean;
  serverError: string | null;
  onSubmit: (email: string, password: string) => void;
  onSwitch: () => void;
  initialEmail?: string;
  onEmailChange?: (email: string) => void;
}

function isEmailFormat(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export function LoginScreen({ loading, serverError, onSubmit, onSwitch, initialEmail, onEmailChange }: Props) {
  const [email, setEmail] = useState(initialEmail ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  const changeEmail = (v: string) => {
    setEmail(v);
    onEmailChange?.(v);
    if (emailError) setEmailError(null);
  };

  const validate = (): boolean => {
    let ok = true;
    if (!email.trim()) {
      setEmailError('Email wajib diisi');
      ok = false;
    } else if (!isEmailFormat(email.trim())) {
      setEmailError('Format email tidak valid');
      ok = false;
    }
    if (!password) {
      setPasswordError('Password wajib diisi');
      ok = false;
    }
    return ok;
  };

  const submit = () => {
    setEmailError(null);
    setPasswordError(null);
    if (!validate()) return;
    onSubmit(email.trim(), password);
  };

  return (
    <View style={styles.content}>
      <View style={styles.hero} accessibilityRole="header">
        <View style={styles.logoMark} accessibilityElementsHidden>
          <Text style={styles.logoMarkText}>K</Text>
        </View>
        <Text style={styles.heroTitle}>Masuk</Text>
        <Text style={styles.heroSub}>Lanjut main bareng kawan</Text>
      </View>

      <UIErrorBanner message={friendlyServerError(serverError)} />

      <UITextInput
        label="Email"
        testID="login-email"
        placeholder="nama@email.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        returnKeyType="next"
        autoFocus
        value={email}
        onChangeText={changeEmail}
        onBlur={() => {
          if (email.trim() && !isEmailFormat(email.trim())) setEmailError('Format email tidak valid');
        }}
        onSubmitEditing={() => passwordRef.current?.focus()}
        error={emailError}
      />
      <UITextInput
        label="Password"
        testID="login-password"
        placeholder="Password akunmu"
        secureTextEntry={!showPassword}
        returnKeyType="done"
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          if (passwordError) setPasswordError(null);
        }}
        onSubmitEditing={submit}
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

      <View style={styles.gap} />
      <UIButton
        title="Masuk"
        onPress={submit}
        loading={loading}
        loadingTitle="Memeriksa akun…"
        accessibilityLabel="Tombol Masuk"
        testID="login-submit"
      />
      <View style={styles.gap} />
      <UIButton
        title="Belum punya akun? Daftar"
        variant="ghost"
        onPress={onSwitch}
        accessibilityLabel="Beralih ke pendaftaran"
      />
      <Text style={styles.footnote}>Lupa password? Hubungi admin KawanSport.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: SPACING.screen },
  hero: { alignItems: 'center', marginBottom: SPACING.lg },
  logoMark: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.brand900,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  logoMarkText: { color: COLORS.lime, fontSize: 28, fontWeight: '800' },
  heroTitle: { ...TYPO.title, color: COLORS.ink },
  heroSub: { fontSize: 14, color: COLORS.muted, marginTop: SPACING.xs },
  peek: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' },
  peekText: { fontSize: 14, fontWeight: '700', color: COLORS.brand700 },
  gap: { height: SPACING.md },
  footnote: { fontSize: 13, color: COLORS.faint, textAlign: 'center', marginTop: SPACING.lg },
});
