import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ViewStyle } from 'react-native';
import {
  ANONYMOUS_DISPLAY_NAME,
  REVIEW_ASPECT_KEYS,
  REVIEW_ASPECT_LABELS,
  RatingItem,
} from '../api/ratings';
import { RatingStarsDisplay } from './RatingStars';
import { UIAvatar } from './ui';
import { PhotoGallery } from './PhotoGallery';
import { sanitizePhotos } from '../api/photos';
import { formatDateShort } from '../api/bookings';
import { COLORS, RADIUS, SPACING } from '../theme';

export interface ReviewCardProps {
  /** Data review dari API */
  rating: RatingItem;
  /** Callback saat user tap profil reviewer (optional) */
  onUserPress?: (userId: string) => void;
  /** Callback saat user tap hapus review (untuk owner) */
  onDelete?: (ratingId: string) => void;
  /** Callback saat user tap edit review (untuk owner) */
  onEdit?: (rating: RatingItem) => void;
  /** ID user yang sedang login (untuk cek ownership) */
  currentUserId?: string | null;
  /** Style tambahan */
  style?: ViewStyle;
}

/**
 * ReviewCard - menampilkan satu review user dengan:
 * - Avatar + inisial fallback + nama user
 * - Rating bintang amber
 * - Komentar review
 * - Tanggal
 * - Badge court biru lembut (bila rating court spesifik)
 * - Action buttons (edit/hapus) jika owner
 */
export function ReviewCard({
  rating,
  onUserPress,
  onDelete,
  onEdit,
  currentUserId,
  style,
}: ReviewCardProps) {
  const isOwner = currentUserId && rating.userId === currentUserId;
  const hasReview = rating.review?.comment && rating.review.comment.trim().length > 0;
  /** ST-06: anonim bila flag set DAN viewer bukan owner (server sudah samarkan nama). */
  const isAnonymous = !!rating.review?.isAnonymous;
  const displayName = isAnonymous
    ? ANONYMOUS_DISPLAY_NAME
    : rating.user.displayName || 'Kawan main';
  /** ST-06: aspek yang dinilai saja (parsial). */
  const aspectEntries = REVIEW_ASPECT_KEYS.filter(
    (k) => rating.review?.aspects?.[k] !== undefined && rating.review?.aspects?.[k] !== null,
  );
  const tags = rating.review?.tags ?? [];

  const handleUserPress = () => {
    if (onUserPress) onUserPress(rating.userId);
  };

  const handleDelete = () => {
    if (onDelete) onDelete(rating.id);
  };

  const handleEdit = () => {
    if (onEdit) onEdit(rating);
  };

  return (
    <View style={[styles.card, style]}>
      {/* Header: User + Rating */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleUserPress} style={styles.userRow} activeOpacity={0.7}>
          <UIAvatar
            name={isAnonymous ? ANONYMOUS_DISPLAY_NAME : rating.user.displayName}
            uri={isAnonymous ? null : rating.user.avatarUrl}
            size={36}
          />
          <View style={styles.userInfo}>
            <Text style={styles.userName} numberOfLines={1}>
              {displayName}
            </Text>
            <RatingStarsDisplay value={rating.score} size={14} showValue={true} />
          </View>
        </TouchableOpacity>

        <Text style={styles.date}>{formatDateShort(rating.createdAt.split('T')[0])}</Text>
      </View>

      {/* ST-06: badge anonim (publik). */}
      {isAnonymous && (
        <View style={styles.anonBadge} accessibilityLabel="Ulasan anonim">
          <Text style={styles.anonBadgeText}>🕵️ Anonim</Text>
        </View>
      )}

      {/* Review Comment */}
      {hasReview && (
        <View style={styles.reviewContainer}>
          <Text style={styles.reviewText}>{rating.review!.comment}</Text>
        </View>
      )}

      {/* ST-01: foto review (display-only; kosong/tak aman = tak dirender). */}
      {sanitizePhotos(rating.review?.photos).length > 0 ? (
        <View style={styles.photosWrap}>
          <PhotoGallery
            photos={rating.review?.photos}
            label="ulasan"
            height={120}
            testID={`review-photos-${rating.id}`}
          />
        </View>
      ) : null}

      {/* ST-06: aspek penilaian (hanya yang dinilai). */}
      {aspectEntries.length > 0 && (
        <View style={styles.aspectsWrap} testID={`review-aspects-${rating.id}`}>
          {aspectEntries.map((k) => (
            <View key={k} style={styles.aspectChip} accessibilityLabel={`Aspek ${REVIEW_ASPECT_LABELS[k]}: ${rating.review!.aspects![k]} dari 5`}>
              <Text style={styles.aspectChipText}>
                {REVIEW_ASPECT_LABELS[k]} {rating.review!.aspects![k]}/5
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* ST-06: tag sorotan. */}
      {tags.length > 0 && (
        <View style={styles.tagsWrap} testID={`review-tags-${rating.id}`}>
          {tags.map((t) => (
            <View key={t} style={styles.tagChip} accessibilityLabel={`Tag ${t}`}>
              <Text style={styles.tagChipText}>#{t}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Court info jika rating untuk court spesifik */}
      {rating.courtId && (
        <View style={styles.courtBadge} accessibilityLabel="Ulasan untuk lapangan spesifik">
          <Text style={styles.courtBadgeText}>🏟 Ulasan lapangan spesifik</Text>
        </View>
      )}

      {/* Actions untuk owner */}
      {isOwner && (
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={handleEdit}
            style={styles.editButton}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Ubah ulasan saya"
          >
            <Text style={styles.editButtonText}>Ubah</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleDelete}
            style={[styles.editButton, styles.deleteButton]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Hapus ulasan saya"
          >
            <Text style={styles.deleteButtonText}>Hapus</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userInfo: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.ink,
  },
  date: {
    fontSize: 12,
    color: COLORS.faint,
    marginLeft: SPACING.sm,
  },
  reviewContainer: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
  },
  reviewText: {
    fontSize: 14,
    lineHeight: 22,
    color: COLORS.ink,
  },
  photosWrap: {
    marginTop: SPACING.sm,
  },
  courtBadge: {
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    backgroundColor: COLORS.brand100,
    borderRadius: RADIUS.full,
    alignSelf: 'flex-start',
  },
  courtBadgeText: {
    fontSize: 12,
    color: COLORS.brand900,
    fontWeight: '700',
  },
  anonBadge: {
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    backgroundColor: COLORS.bgAlt,
    borderRadius: RADIUS.full,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  anonBadgeText: {
    fontSize: 12,
    color: COLORS.muted,
    fontWeight: '700',
  },
  aspectsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: SPACING.sm,
  },
  aspectChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    backgroundColor: COLORS.star,
    opacity: 0.9,
    borderRadius: RADIUS.full,
  },
  aspectChipText: {
    fontSize: 12,
    color: COLORS.bg,
    fontWeight: '700',
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: SPACING.sm,
  },
  tagChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    backgroundColor: COLORS.bgAlt,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  tagChipText: {
    fontSize: 12,
    color: COLORS.brand700,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
  },
  editButton: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.brand700,
    minHeight: 44,
    justifyContent: 'center',
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.bg,
  },
  deleteButton: {
    backgroundColor: COLORS.bg,
    borderWidth: 1.5,
    borderColor: COLORS.danger,
    marginLeft: SPACING.sm,
  },
  deleteButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.danger,
  },
});
