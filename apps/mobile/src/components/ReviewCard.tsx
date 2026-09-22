import React from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity, ViewStyle } from 'react-native';
import { RatingItem } from '../api/ratings';
import { RatingStarsDisplay } from './RatingStars';
import { formatDateShort } from '../api/bookings';

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
 * - Avatar + nama user
 * - Rating bintang
 * - Komentar review
 * - Tanggal
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
          <Image
            source={rating.user.avatarUrl ? { uri: rating.user.avatarUrl } : require('../assets/placeholder-avatar.png')}
            style={styles.avatar}
            resizeMode="cover"
          />
          <View style={styles.userInfo}>
            <Text style={styles.userName} numberOfLines={1}>
              {rating.user.displayName || 'Pengguna'}
            </Text>
            <RatingStarsDisplay
              value={rating.score}
              size={14}
              showValue={true}
              activeColor="#FFC107"
              inactiveColor="#E0E0E0"
            />
          </View>
        </TouchableOpacity>

        <Text style={styles.date}>{formatDateShort(rating.createdAt.split('T')[0])}</Text>
      </View>

      {/* Review Comment */}
      {hasReview && (
        <View style={styles.reviewContainer}>
          <Text style={styles.reviewText}>{rating.review!.comment}</Text>
        </View>
      )}

      {/* Court info jika rating untuk court spesifik */}
      {rating.courtId && (
        <View style={styles.courtBadge}>
          <Text style={styles.courtBadgeText}>Rating untuk lapangan spesifik</Text>
        </View>
      )}

      {/* Actions untuk owner */}
      {isOwner && (
        <View style={styles.actions}>
          <TouchableOpacity onPress={handleEdit} style={styles.actionButton} activeOpacity={0.7}>
            <Text style={styles.actionButtonText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} style={[styles.actionButton, styles.actionButtonDestructive]} activeOpacity={0.7}>
            <Text style={styles.actionButtonTextDestructive}>Hapus</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    backgroundColor: '#F0F0F0',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  date: {
    fontSize: 12,
    color: '#888',
    marginLeft: 8,
  },
  reviewContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  reviewText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#333',
  },
  courtBadge: {
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#E8F0FE',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  courtBadgeText: {
    fontSize: 11,
    color: '#1A73E8',
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
  },
  actionButtonDestructive: {
    backgroundColor: '#FCE8E6',
    marginLeft: 8,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A73E8',
  },
  actionButtonTextDestructive: {
    color: '#C00',
  },
});