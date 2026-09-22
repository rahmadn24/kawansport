import React, { useState } from 'react';
import {
  ActivityIndicator,
  Button,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

interface Props {
  loading: boolean;
  serverError: string | null;
  onSubmit: (email: string, password: string, displayName?: string) => void;
  onSwitch: () => void;
}

export function RegisterScreen({ loading, serverError, onSubmit, onSwitch }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = () => {
    if (!email.trim() || !password) {
      setLocalError('Email dan password wajib diisi');
      return;
    }
    if (password.length < 8) {
      setLocalError('Password minimal 8 karakter');
      return;
    }
    setLocalError(null);
    onSubmit(email.trim(), password, displayName.trim() || undefined);
  };

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Daftar</Text>
      <TextInput
        style={styles.input}
        placeholder="Nama (opsional)"
        value={displayName}
        onChangeText={setDisplayName}
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password (min. 8)"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {localError ? <Text style={styles.error}>{localError}</Text> : null}
      {serverError ? <Text style={styles.error}>{serverError}</Text> : null}
      {loading ? (
        <ActivityIndicator />
      ) : (
        <Button title="Register" onPress={submit} />
      )}
      <View style={styles.gap} />
      <Button title="Sudah punya akun? Masuk" onPress={onSwitch} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  error: { color: '#c00', marginBottom: 12, textAlign: 'center' },
  gap: { height: 12 },
});
