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
  Switch,
  ScrollView,
} from 'react-native';
import { RatingStarsInput } from './RatingStars';
import { PhotoUploadDisabled } from './PhotoGallery';
import {
  CreateRatingInput,
  MAX_REVIEW_TAGS,
  REVIEW_ASPECT_KEYS,
  REVIEW_ASPECT_LABELS,
  REVIEW_TAG_PRESETS,
  ReviewAspectKey,
  ReviewAspects,
  normalizeTagsClient,
} from '../api/ratings';
import { COLORS, RADIUS, SPACING } from '../theme';

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
  initial?: {
    score: number;
    comment?: string | null;
    aspects?: ReviewAspects | null;
    tags?: string[] | null;
    isAnonymous?: boolean;
  };
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
  /** ST-06: aspek per fasilitas (null = belum dinilai, opsional). */
  const [aspects, setAspects] = useState<Record<ReviewAspectKey, number | null>>({
    lapangan: null,
    cahaya: null,
    bersih: null,
    staf: null,
  });
  /** ST-06: tag terpilih (maks 5) + input custom. */
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  /** ST-06: mode anonim. */
  const [isAnonymous, setIsAnonymous] = useState(false);

  const MAX_COMMENT_LENGTH = 1000;

  // Reset form saat modal dibuka/ditutup; mode edit terisi nilai existing.
  const initialScore = initial?.score ?? 0;
  const initialComment = initial?.comment ?? '';
  const initialAspectsKey = JSON.stringify(initial?.aspects ?? null);
  const initialTagsKey = JSON.stringify(initial?.tags ?? []);
  const initialAnonymous = initial?.isAnonymous ?? false;
  useEffect(() => {
    if (visible) {
      setScore(initialScore);
      setComment(initialComment);
      setCharCount(initialComment.length);
      setTouched({ score: false, comment: false });
      const parsedAspects: ReviewAspects | null = initialAspectsKey
        ? (JSON.parse(initialAspectsKey) as ReviewAspects | null)
        : null;
      setAspects({
        lapangan: parsedAspects?.lapangan ?? null,
        cahaya: parsedAspects?.cahaya ?? null,
        bersih: parsedAspects?.bersih ?? null,
        staf: parsedAspects?.staf ?? null,
      });
      setTags(normalizeTagsClient(initialTagsKey ? (JSON.parse(initialTagsKey) as string[]) : []));
      setTagInput('');
      setIsAnonymous(initialAnonymous);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialScore, initialComment, initialAspectsKey, initialTagsKey, initialAnonymous]);

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

    const cleanAspects: ReviewAspects = {};
    (Object.keys(aspects) as ReviewAspectKey[]).forEach((k) => {
      const v = aspects[k];
      if (v !== null && v >= 1 && v <= 5) cleanAspects[k] = v;
    });

    const input: CreateRatingInput = {
      venueId,
      courtId: courtId ?? null,
      score,
      comment: comment.trim() || undefined,
      // ST-06: replace-total — kirim selalu (objek kosong = tanpa aspek)
      // agar mode edit bisa menghapus aspek yang sudah ada.
      aspects: cleanAspects,
      tags: normalizeTagsClient(tags),
      isAnonymous,
    };

    try {
      await onSubmit(input);
      onClose();
    } catch {
      // Error handled by parent via error prop
    }
  };

  /** ST-06: tap nilai aspek yang aktif = kosongkan (opsional). */
  const toggleAspect = (key: ReviewAspectKey, value: number) => {
    setAspects((prev) => ({ ...prev, [key]: prev[key] === value ? null : value }));
  };

  /** ST-06: toggle preset / hapus tag; tambah custom via input. */
  const toggleTag = (tag: string) => {
    const norm = tag.trim().toLowerCase();
    if (!norm) return;
    setTags((prev) =>
      prev.includes(norm)
        ? prev.filter((t) => t !== norm)
        : prev.length >= MAX_REVIEW_TAGS
          ? prev
          : [...prev, norm],
    );
  };

  const addCustomTag = () => {
    const norm = tagInput.trim().toLowerCase();
    if (!norm || tags.includes(norm) || tags.length >= MAX_REVIEW_TAGS) return;
    setTags((prev) => [...prev, norm]);
    setTagInput('');
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

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
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

            {/* ST-06: aspek per fasilitas (opsional, tap ulang untuk kosongkan). */}
            <View style={styles.section}>
              <Text style={styles.label}>Nilai per aspek (opsional)</Text>
              {REVIEW_ASPECT_KEYS.map((key) => (
                <View
                  key={key}
                  style={styles.aspectRow}
                  accessibilityLabel={`Aspek ${REVIEW_ASPECT_LABELS[key]}`}
                >
                  <Text style={styles.aspectLabel}>{REVIEW_ASPECT_LABELS[key]}</Text>
                  <View style={styles.aspectDots}>
                    {[1, 2, 3, 4, 5].map((n) => {
                      const active = aspects[key] !== null && (aspects[key] as number) >= n;
                      return (
                        <TouchableOpacity
                          key={n}
                          onPress={() => toggleAspect(key, n)}
                          style={[styles.aspectDot, active && styles.aspectDotActive]}
                          activeOpacity={0.7}
                          accessibilityRole="button"
                          accessibilityLabel={`Aspek ${REVIEW_ASPECT_LABELS[key]} nilai ${n}`}
                          accessibilityState={{ selected: aspects[key] === n }}
                          testID={`aspect-${key}-${n}`}
                        >
                          <Text style={[styles.aspectDotText, active && styles.aspectDotTextActive]}>
                            {n}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>

            {/* ST-06: tag sorotan (preset + custom, maks 5). */}
            <View style={styles.section}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Sorotan (opsional)</Text>
                <Text style={styles.charCount}>
                  {tags.length}/{MAX_REVIEW_TAGS}
                </Text>
              </View>
              <View style={styles.chipWrap}>
                {REVIEW_TAG_PRESETS.map((preset) => {
                  const selected = tags.includes(preset);
                  return (
                    <TouchableOpacity
                      key={preset}
                      onPress={() => toggleTag(preset)}
                      style={[styles.chip, selected && styles.chipSelected]}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={`Tag ${preset}`}
                      accessibilityState={{ selected }}
                      testID={`tag-preset-${preset}`}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {selected ? `✓ ${preset}` : `+ ${preset}`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                {tags
                  .filter((t) => !(REVIEW_TAG_PRESETS as readonly string[]).includes(t))
                  .map((t) => (
                    <TouchableOpacity
                      key={t}
                      onPress={() => toggleTag(t)}
                      style={[styles.chip, styles.chipSelected]}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={`Hapus tag ${t}`}
                      testID={`tag-custom-${t}`}
                    >
                      <Text style={[styles.chipText, styles.chipTextSelected]}>{`✓ ${t} ✕`}</Text>
                    </TouchableOpacity>
                  ))}
              </View>
              <View style={styles.tagInputRow}>
                <TextInput
                  style={styles.tagInput}
                  value={tagInput}
                  onChangeText={setTagInput}
                  placeholder="Tag sendiri, mis. parkir luas"
                  placeholderTextColor={COLORS.faint}
                  maxLength={30}
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={addCustomTag}
                  accessibilityLabel="Tambah tag sendiri"
                  testID="tag-custom-input"
                />
                <TouchableOpacity
                  onPress={addCustomTag}
                  style={[
                    styles.tagAddButton,
                    (tags.length >= MAX_REVIEW_TAGS || !tagInput.trim()) &&
                      styles.submitButtonDisabled,
                  ]}
                  disabled={tags.length >= MAX_REVIEW_TAGS || !tagInput.trim()}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Tambah tag"
                  testID="tag-add-button"
                >
                  <Text style={styles.submitText}>+ Tag</Text>
                </TouchableOpacity>
              </View>
              {tags.length >= MAX_REVIEW_TAGS && (
                <Text style={styles.hintText}>Maksimal {MAX_REVIEW_TAGS} tag ya</Text>
              )}
            </View>

            {/* ST-06: mode anonim. */}
            <View style={styles.section}>
              <View style={styles.anonRow}>
                <View style={styles.anonText}>
                  <Text style={styles.label}>Tampilkan sebagai Anonim</Text>
                  <Text style={styles.hintText}>
                    Nama + fotomu disamarkan ke publik (owner venue tidak lihat siapa kamu)
                  </Text>
                </View>
                <Switch
                  value={isAnonymous}
                  onValueChange={setIsAnonymous}
                  accessibilityLabel="Tampilkan sebagai Anonim"
                  testID="anonymous-switch"
                />
              </View>
            </View>

            {/* ST-01: foto review ditampilkan di ReviewCard; upload baru
                DISABLED jujur (POST /uploads butuh file picker native). */}
            {/* TODO(ST-01-upload): aktifkan upload setelah file picker native ada. */}
            <PhotoUploadDisabled context="foto ulasan" />

            {/* Error message */}
            {error && <Text style={styles.errorText}>{error}</Text>}
            </ScrollView>

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
    marginBottom: SPACING.md,
  },
  scroll: {
    maxHeight: 420,
  },
  scrollContent: {
    paddingBottom: SPACING.sm,
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
  aspectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  aspectLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.ink,
    flex: 1,
  },
  aspectDots: {
    flexDirection: 'row',
    gap: 6,
  },
  aspectDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: COLORS.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bg,
  },
  aspectDotActive: {
    borderColor: COLORS.star,
    backgroundColor: COLORS.star,
  },
  aspectDotText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.muted,
  },
  aspectDotTextActive: {
    color: COLORS.bg,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: COLORS.line,
    backgroundColor: COLORS.bg,
    minHeight: 40,
    justifyContent: 'center',
  },
  chipSelected: {
    borderColor: COLORS.brand700,
    backgroundColor: COLORS.brand100,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.muted,
  },
  chipTextSelected: {
    color: COLORS.brand900,
    fontWeight: '700',
  },
  tagInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
    gap: 8,
  },
  tagInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    minHeight: 44,
    fontSize: 14,
    color: COLORS.ink,
    backgroundColor: COLORS.bg,
  },
  tagAddButton: {
    paddingHorizontal: SPACING.lg,
    minHeight: 44,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.brand700,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintText: {
    fontSize: 12,
    color: COLORS.faint,
    marginTop: 6,
  },
  anonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  anonText: {
    flex: 1,
  },
});
