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
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { RatingStarsInput } from './RatingStars';
import { CreateRatingInput } from '../api/ratings';

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
}

/**
 * RatingFormModal - modal form untuk membuat rating + review.
 * Fitur:
 * - Bintang interaktif 1-5 (wajib)
 * - Textarea komentar (opsional, max 1000 char)
 * - Validasi client-side
 * - Keyboard avoiding
 * - Loading state
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
}: RatingFormModalProps) {
  const [score, setScore] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [charCount, setCharCount] = useState(0);
  const [touched, setTouched] = useState({ score: false, comment: false });

  const MAX_COMMENT_LENGTH = 1000;

  // Reset form saat modal dibuka/ditutup
  useEffect(() => {
    if (visible) {
      setScore(0);
      setComment('');
      setCharCount(0);
      setTouched({ score: false, comment: false });
    }
  }, [visible]);

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
      <TouchableOpacity onPress={onClose} style={styles.overlay} accessible={false}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoiding}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <View style={styles.modalContainer}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Rate {targetType === 'venue' ? 'Venue' : 'Lapangan'}</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.7}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.targetName}>{targetName}</Text>

            {/* Rating Stars */}
            <View style={styles.section}>
              <Text style={styles.label}>Rating <Text style={styles.required}>*</Text></Text>
              <RatingStarsInput
                value={score}
                onChange={setScore}
                size={36}
                accessibilityLabel="Pilih rating 1-5 bintang"
              />
              {touched.score && score === 0 && (
                <Text style={styles.errorText}>Rating wajib dipilih (minimal 1 bintang)</Text>
              )}
            </View>

            {/* Comment */}
            <View style={styles.section}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Ulasan (opsional)</Text>
                <Text style={styles.charCount}>{charCount}/{MAX_COMMENT_LENGTH}</Text>
              </View>
              <TextInput
                style={styles.textarea}
                value={comment}
                onChangeText={handleCommentChange}
                onBlur={() => handleBlur('comment')}
                placeholder="Bagikan pengalaman Anda... (maks 1000 karakter)"
                placeholderTextColor="#999"
                multiline
                maxLength={MAX_COMMENT_LENGTH}
                autoCapitalize="sentences"
                returnKeyType="done"
              />
            </View>

            {/* Error message */}
            {error && <Text style={styles.errorText}>{error}</Text>}

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity
                onPress={onClose}
                style={styles.cancelButton}
                disabled={submitting}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSubmit}
                style={[styles.submitButton, score === 0 && styles.submitButtonDisabled]}
                disabled={submitting || score === 0}
                activeOpacity={0.7}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitText}>Kirim</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  keyboardAvoiding: {
    flex: 1,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 32,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  closeButton: {
    padding: 4,
  },
  closeText: {
    fontSize: 24,
    color: '#888',
    lineHeight: 24,
  },
  targetName: {
    fontSize: 15,
    color: '#1A73E8',
    fontWeight: '600',
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  required: {
    color: '#C00',
    marginLeft: 2,
  },
  charCount: {
    fontSize: 12,
    color: '#888',
  },
  textarea: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
    backgroundColor: '#FAFAFA',
  },
  errorText: {
    color: '#C00',
    fontSize: 13,
    marginTop: 6,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  cancelButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F0F0F0',
    marginRight: 12,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  submitButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#1A73E8',
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#A8C8E8',
  },
  submitText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});