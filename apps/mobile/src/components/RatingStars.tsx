import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';

export interface RatingStarsProps {
  /** Nilai rating 0-5 (bisa desimal untuk display, integer untuk input) */
  value: number;
  /** Maksimal bintang (default 5) */
  maxStars?: number;
  /** Ukuran bintang (default 24) */
  size?: number;
  /** Warna bintang aktif (default '#FFC107') */
  activeColor?: string;
  /** Warna bintang tidak aktif (default '#E0E0E0') */
  inactiveColor?: string;
  /** Jika true, bintang bisa diklik untuk input rating */
  interactive?: boolean;
  /** Callback saat nilai berubah (hanya jika interactive=true) */
  onChange?: (value: number) => void;
  /** Label aksesibilitas */
  accessibilityLabel?: string;
  /** Tampilkan angka rating di samping bintang */
  showValue?: boolean;
  /** Style tambahan container */
  style?: ViewStyle;
}

/**
 * Komponen RatingStars - menampilkan atau input rating bintang 1-5.
 * Mendukung mode display (read-only) dan interactive (input).
 * Bintang diisi penuh (★) untuk nilai integer, setengah (⯨) untuk .5
 */
export function RatingStars({
  value,
  maxStars = 5,
  size = 24,
  activeColor = '#F59E0B',
  inactiveColor = '#E2E8F0',
  interactive = false,
  onChange,
  accessibilityLabel,
  showValue = false,
  style,
}: RatingStarsProps) {
  const clampedValue = Math.max(0, Math.min(maxStars, value));

  const renderStars = () => {
    const stars: React.ReactElement[] = [];
    for (let i = 1; i <= maxStars; i++) {
      let fill: 'full' | 'half' | 'empty' = 'empty';
      if (clampedValue >= i) {
        fill = 'full';
      } else if (clampedValue >= i - 0.5) {
        fill = 'half';
      }

      const starChar = fill === 'full' ? '★' : fill === 'half' ? '⯨' : '☆';
      const color = fill === 'empty' ? inactiveColor : activeColor;

      if (interactive) {
        stars.push(
          <TouchableOpacity
            key={i}
            onPress={() => onChange?.(i)}
            onPressIn={() => onChange?.(i)} // Responsive feel
            accessibilityLabel={`${accessibilityLabel || 'Rating'} ${i} dari ${maxStars}`}
            accessibilityRole="button"
            accessibilityState={{ selected: i <= Math.floor(clampedValue) }}
            style={styles.starTouch}
          >
            <Text style={[styles.star, { fontSize: size, color }]}>{starChar}</Text>
          </TouchableOpacity>,
        );
      } else {
        stars.push(
          <Text
            key={i}
            style={[styles.star, { fontSize: size, color }]}
            importantForAccessibility="no-hide-descendants"
          >
            {starChar}
          </Text>,
        );
      }
    }
    return stars;
  };

  return (
    <View style={[styles.container, style]} accessibilityLabel={accessibilityLabel || `Rating ${clampedValue} dari ${maxStars}`}>
      <View style={styles.starsRow}>{renderStars()}</View>
      {showValue && (
        <Text style={[styles.valueText, { fontSize: size * 0.7 }]}>
          {clampedValue.toFixed(clampedValue % 1 === 0 ? 0 : 1)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starsRow: {
    flexDirection: 'row',
    marginRight: 4,
  },
  star: {
    lineHeight: 24,
    includeFontPadding: false,
  },
  starTouch: {
    padding: 2,
  },
  valueText: {
    fontWeight: '600',
    color: '#333',
    marginLeft: 2,
  },
});

/** RatingStarsDisplay - versi read-only yang lebih ringan untuk daftar review */
export function RatingStarsDisplay({
  value,
  maxStars = 5,
  size = 16,
  activeColor = '#F59E0B',
  inactiveColor = '#E2E8F0',
  showValue = true,
  style,
}: Omit<RatingStarsProps, 'interactive' | 'onChange'>) {
  return (
    <RatingStars
      value={value}
      maxStars={maxStars}
      size={size}
      activeColor={activeColor}
      inactiveColor={inactiveColor}
      interactive={false}
      showValue={showValue}
      style={style}
    />
  );
}

/** RatingStarsInput - versi interactive untuk form */
export function RatingStarsInput({
  value,
  onChange,
  maxStars = 5,
  size = 32,
  activeColor = '#F59E0B',
  inactiveColor = '#E2E8F0',
  accessibilityLabel = 'Pilih rating',
  style,
}: Pick<RatingStarsProps, 'value' | 'onChange' | 'maxStars' | 'size' | 'activeColor' | 'inactiveColor' | 'accessibilityLabel' | 'style'>) {
  return (
    <RatingStars
      value={value}
      maxStars={maxStars}
      size={size}
      activeColor={activeColor}
      inactiveColor={inactiveColor}
      interactive={true}
      onChange={onChange}
      accessibilityLabel={accessibilityLabel}
      showValue={false}
      style={style}
    />
  );
}