import { Link } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SvgUri } from 'react-native-svg';
import { Image } from 'expo-image';

import { useCart } from '@/lib/cart-context';
import { formatNaira, resolveImageUrl } from '@/lib/api';
import type { Product } from '@/lib/types';
import { colors, radius, shadows, spacing, typography } from '@/theme';

/**
 * One menu card on Home (FR-M2.1): image, name, ₦ price, short description,
 * "Add to cart" (guest basket in P2) + Details link.
 *
 * Catalogue images are `.svg`, which the native image pipeline won't render
 * — `SvgUri` handles those, `expo-image` everything else (PRD-LESSON3 R3).
 * A failed image collapses to a branded placeholder so one bad file can
 * never break the menu.
 */
export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const [justAdded, setJustAdded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uri = resolveImageUrl(product.imageUrl);
  const isSvg = product.imageUrl.toLowerCase().endsWith('.svg');

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const handleAdd = () => {
    addItem(product.slug, 1);
    setJustAdded(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setJustAdded(false), 1500);
  };

  return (
    <View style={styles.card}>
      <Link asChild href={{ pathname: '/product/[slug]', params: { slug: product.slug } }}>
        <Pressable accessibilityRole="button">
          <View style={styles.imageWrap}>
            {imageFailed ? (
              <View style={styles.imageFallback}>
                <Text style={styles.imageFallbackText}>NaijaBites</Text>
              </View>
            ) : isSvg ? (
              <SvgUri
                height={170}
                onError={() => setImageFailed(true)}
                uri={uri}
                width={320}
              />
            ) : (
              <Image
                accessibilityLabel={product.name}
                contentFit="cover"
                onError={() => setImageFailed(true)}
                source={{ uri }}
                style={styles.image}
                transition={200}
              />
            )}
          </View>
        </Pressable>
      </Link>

      <View style={styles.body}>
        <View style={styles.topRow}>
          <Link asChild href={{ pathname: '/product/[slug]', params: { slug: product.slug } }}>
            <Pressable style={styles.namePress}>
              <Text style={styles.name}>{product.name}</Text>
            </Pressable>
          </Link>
          <View style={styles.pricePill}>
            <Text style={styles.price}>{formatNaira(product.priceKobo)}</Text>
          </View>
        </View>

        <Text numberOfLines={2} style={styles.description}>
          {product.description}
        </Text>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={handleAdd}
            style={({ pressed }) => [
              styles.addButton,
              pressed && styles.addButtonPressed,
            ]}
          >
            <Text style={styles.addLabel}>{justAdded ? 'Added ✓' : 'Add to cart'}</Text>
          </Pressable>
          <Link asChild href={{ pathname: '/product/[slug]', params: { slug: product.slug } }}>
            <Pressable style={styles.detailsButton}>
              <Text style={styles.detailsLabel}>Details</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    ...shadows.card,
  },
  imageWrap: {
    height: 170,
    backgroundColor: colors.brandLight,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandLight,
  },
  imageFallbackText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.brand,
  },
  body: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  namePress: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    color: colors.brand,
  },
  pricePill: {
    backgroundColor: colors.brandLight,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  price: {
    ...typography.price,
    fontSize: 14,
  },
  description: {
    ...typography.small,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  addButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  addButtonPressed: {
    backgroundColor: colors.brandDark,
  },
  addLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
  detailsButton: {
    minHeight: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.white,
  },
  detailsLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.brand,
  },
});
