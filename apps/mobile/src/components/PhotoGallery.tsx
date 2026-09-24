/**
 * Galeri foto ST-01 (display-only): horizontal scroll sederhana + placeholder
 * jujur bila kosong. Tanpa carousel lib / dep native baru.
 */
import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { COLORS, RADIUS, SPACING } from '../theme';
import { resolvePhotoUrl, sanitizePhotos } from '../api/photos';

interface PhotoGalleryProps {
  /** Daftar URL mentah dari API (difilter aman di dalam). */
  photos: readonly unknown[] | null | undefined;
  /** Label aksesibilitas, mis. nama venue/event/produk. */
  label: string;
  /** Tinggi tiap foto (default 180). */
  height?: number;
  /** TestID untuk pengujian. */
  testID?: string;
}

/**
 * Galeri horizontal foto asli. Bila tak ada foto aman: placeholder
 * "Belum ada foto" (JUJUR — bukan foto palsu).
 */
export function PhotoGallery({ photos, label, height = 180, testID }: PhotoGalleryProps) {
  const clean = sanitizePhotos(photos);
  if (clean.length === 0) {
    return (
      <View
        style={[styles.empty, { minHeight: Math.max(96, height / 2) }]}
        testID={testID ?? 'photo-empty'}
        accessibilityRole="image"
        accessibilityLabel={`${label}: belum ada foto`}
      >
        <Text style={styles.emptyIcon} accessibilityElementsHidden>
          📷
        </Text>
        <Text style={styles.emptyText}>Belum ada foto</Text>
      </View>
    );
  }
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      testID={testID ?? 'photo-gallery'}
      accessibilityLabel={`Galeri foto ${label}, ${clean.length} foto`}
    >
      {clean.map((p, i) => (
        <Image
          key={`${i}-${p}`}
          source={{ uri: resolvePhotoUrl(p) }}
          style={[styles.photo, { height, width: Math.round(height * 1.5) }]}
          accessibilityRole="image"
          accessibilityLabel={`Foto ${i + 1} dari ${clean.length}: ${label}`}
          testID={`photo-${i}`}
        />
      ))}
    </ScrollView>
  );
}

interface PhotoThumbProps {
  photos: readonly unknown[] | null | undefined;
  label: string;
  size?: number;
  /** Fallback bila kosong (mis. inisial) — dirender pemanggil bila null. */
  fallback?: React.ReactNode;
  testID?: string;
}

/**
 * Thumbnail foto pertama untuk kartu list. Kembalikan null-image bila kosong
 * agar pemanggil bisa pakai placeholder inisial/ikon lama (tak ubah alur).
 */
export function PhotoThumb({ photos, label, size = 56, testID }: PhotoThumbProps) {
  const clean = sanitizePhotos(photos);
  if (clean.length === 0) return null;
  return (
    <Image
      source={{ uri: resolvePhotoUrl(clean[0]) }}
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        backgroundColor: COLORS.line,
      }}
      accessibilityRole="image"
      accessibilityLabel={`Foto ${label}`}
      testID={testID ?? 'photo-thumb'}
    />
  );
}

/**
 * Banner jujur untuk upload baru: POST /uploads (multipart) butuh file picker
 * native yang TAK tersedia — JANGAN tambah dep native di task ini.
 */
// TODO(ST-01-upload): aktifkan upload (POST /uploads multipart) setelah file
// picker native tersedia; sementara tampilkan banner disabled ini.
export function PhotoUploadDisabled({ context = 'foto' }: { context?: string }) {
  return (
    <View
      style={styles.uploadNote}
      testID="photo-upload-disabled"
      accessibilityRole="text"
      accessibilityLabel={`Tambah ${context} baru segera hadir`}
    >
      <Text style={styles.uploadText}>
        📷 Tambah {context} baru segera hadir — butuh file picker native.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingBottom: SPACING.xs },
  photo: {
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.line,
    marginRight: SPACING.sm,
  },
  empty: {
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bgAlt,
    borderWidth: 1,
    borderColor: COLORS.line,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  emptyIcon: { fontSize: 28 },
  emptyText: { fontSize: 13, color: COLORS.faint, marginTop: SPACING.xs, fontWeight: '600' },
  uploadNote: {
    backgroundColor: COLORS.bgAlt,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    marginTop: SPACING.md,
  },
  uploadText: { fontSize: 13, color: COLORS.muted },
});
