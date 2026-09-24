import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { RatingStarsInput } from './RatingStars';
import { PhotoUploadDisabled } from './PhotoGallery';
import { CreateRatingInput } from '../api/ratings';
import { COLORS, RADIUS, SPACING } from '../theme';
// TODO(ST-06): form rating kaya (aspek fasilitas, tag sorotan, foto suasana)
// DISEMBUNYIKAN sampai API review kaya ada — jangan tampilkan input palsu.

export interface RatingFormModalProps {
  /** Modal visibility */
  visible: boolean;
  /** Callback saat modal ditutup */
  onClose: () => void;
  /** Callback saat submit berhasil */
  onSubmit: (input: CreateRatingInput) => Promise<void>;
  /** Venue ID yang dirating */
  venueId: string;
  /** Court ID opsional (jika rating court spesifik) */
  courtId?: string | null;
  /** Nama venue/court untuk ditampilkan di header */
  targetName: string;
  /** Jenis target: 'venue' | 'court' */
  targetType: 'venue' | 'court';
  /** Loading state submit */
  submitting?: boolean;
  /** Error message dari submit sebelumnya */
  error?: string | null;
  /** Nilai awal untuk mode edit (opsional; bila ada, form terisi existing). */
  initial?: { score: number; comment?: string | null };
  /** Label tombol submit (default "Kirim Ulasan"; mode edit pakai "Simpan"). */
  submitLabel?: string;
}

/**
 * RatingFormModal - modal form untuk membuat rating + review.
 * Fitur:
 * - Bintang interaktif 1-5 (wajib)
 * - Textarea komentar (opsional, max 1000 char)
 * - Validasi client-side
 * - Keyboard avoiding
 * - Loading state
 * - Ditutup via tombol X / Batal (bukan ketuk overlay).
 */
export function RatingFormModal({
  visible,
  onClose,
  onSubmit,
  venueId,
  courtId,
  targetName,
  targetType,
  submitting = false,
  error,
  initial,
  submitLabel,
}: RatingFormModalProps) {
  const [score, setScore] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [charCount, setCharCount] = useState(0);
  const [touched, setTouched] = useState({ score: false, comment: false });

  const MAX_COMMENT_LENGTH = 1000;

  // Reset form saat modal dibuka/ditutup; mode edit terisi nilai existing.
  const initialScore = initial?.score ?? 0;
  const initialComment = initial?.comment ?? '';
  useEffect(() => {
    if (visible) {
      setScore(initialScore);
      setComment(initialComment);
      setCharCount(initialComment.length);
      setTouched({ score: false, comment: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialScore, initialComment]);

  const handleCommentChange = (text: string) => {
    if (text.length <= MAX_COMMENT_LENGTH) {
      setComment(text);
      setCharCount(text.length);
    }
  };

  const handleBlur = (field: 'score' | 'comment') => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const validate = (): boolean => {
    let valid = true;
    setTouched({ score: true, comment: true });
    if (score === 0) valid = false;
    return valid;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const input: CreateRatingInput = {
      venueId,
      courtId: courtId ?? null,
      score,
      comment: comment.trim() || undefined,
    };

    try {
      await onSubmit(input);
      onClose();
    } catch {
      // Error handled by parent via error prop
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoiding}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <View style={styles.modalContainer}>
            <View style={styles.handle} accessibilityElementsHidden />
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>
                Nilai {targetType === 'venue' ? 'Venue' : 'Lapangan'}
              </Text>
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeButton}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Tutup form rating"
              >
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.targetName}>{targetName}</Text>

            {/* Rating Stars */}
            <View style={styles.section}>
              <Text style={styles.label}>
                Rating <Text style={styles.required}>*</Text>
              </Text>
              <RatingStarsInput
                value={score}
                onChange={setScore}
                size={36}
                accessibilityLabel="Pilih rating 1 sampai 5 bintang"
              />
              {touched.score && score === 0 && (
                <Text style={styles.errorText}>Pilih dulu bintangnya, minimal 1 ya</Text>
              )}
            </View>

            {/* Comment */}
            <View style={styles.section}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Ceritakan pengalamanmu (opsional)</Text>
                <Text style={styles.charCount}>
                  {charCount}/{MAX_COMMENT_LENGTH}
                </Text>
              </View>
              <TextInput
                style={styles.textarea}
                value={comment}
                onChangeText={handleCommentChange}
                onBlur={() => handleBlur('comment')}
                placeholder="Lapangannya gimana? Ceritain biar kawan lain kebayang…"
                placeholderTextColor={COLORS.faint}
                multiline
                maxLength={MAX_COMMENT_LENGTH}
                autoCapitalize="sentences"
                returnKeyType="done"
                accessibilityLabel="Ceritakan pengalamanmu"
              />
            </View>

            {/* TODO(ST-06): aspek fasilitas, tag sorotan
                DISEMBUNYIKAN sampai API review kaya tersedia. */}
            {/* ST-01: foto review ditampilkan di ReviewCard; upload baru
                DISABLED jujur (POST /uploads butuh file picker native). */}
            {/* TODO(ST-01-upload): aktifkan upload setelah file picker native ada. */}
            <PhotoUploadDisabled context="foto ulasan" />

            {/* Error message */}
            {error && <Text style={styles.errorText}>{error}</Text>}

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity
                onPress={onClose}
                style={styles.cancelButton}
                disabled={submitting}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Batal mengisi rating"
              >
                <Text style={styles.cancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSubmit}
                style={[styles.submitButton, score === 0 && styles.submitButtonDisabled]}
                disabled={submitting || score === 0}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={submitLabel ?? 'Kirim rating'}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={COLORS.bg} />
                ) : (
                  <Text style={styles.submitText}>{submitLabel ?? 'Kirim Ulasan'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(11,27,51,0.5)',
    justifyContent: 'flex-end',
  },
  keyboardAvoiding: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    padding: SPACING.xl,
    paddingBottom: 32,
    maxHeight: '85%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.line,
    alignSelf: 'center',
    marginBottom: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.ink,
  },
  closeButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 22,
    color: COLORS.muted,
    lineHeight: 24,
  },
  targetName: {
    fontSize: 15,
    color: COLORS.brand700,
    fontWeight: '700',
    marginBottom: SPACING.lg,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.ink,
    marginBottom: SPACING.sm,
  },
  required: {
    color: COLORS.danger,
    marginLeft: 2,
  },
  charCount: {
    fontSize: 12,
    color: COLORS.faint,
  },
  textarea: {
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
    backgroundColor: COLORS.bg,
    color: COLORS.ink,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 13,
    marginTop: 6,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  cancelButton: {
    paddingHorizontal: SPACING.xl,
    minHeight: 48,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.bgAlt,
    marginRight: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.muted,
  },
  submitButton: {
    paddingHorizontal: SPACING.xl,
    minHeight: 48,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.accent,
    minWidth: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.55,
  },
  submitText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.bg,
  },
});
