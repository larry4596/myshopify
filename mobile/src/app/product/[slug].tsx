import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SvgUri } from 'react-native-svg';
import { Image } from 'expo-image';

import { BrandHeader } from '@/components/brand-header';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { useCart } from '@/lib/cart-context';
import { formatNaira, resolveImageUrl } from '@/lib/api';
import { useProduct } from '@/lib/products';
import { colors, radius, shadows, spacing, typography } from '@/theme';

const MAX_CART_QUANTITY = 20;

/**
 * Product detail (FR-M2.2): full description, server ₦ price and a 1–20
 * quantity stepper. Selecting from the cached catalogue — no second fetch.
 */
export default function ProductDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { product, isLoading, isError, refetch } = useProduct(slug);
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const step = (delta: number) => {
    setQuantity((prev) => Math.min(MAX_CART_QUANTITY, Math.max(1, prev + delta)));
  };

  const handleAdd = () => {
    if (!product) return;
    addItem(product.slug, quantity);
    setJustAdded(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setJustAdded(false), 1500);
  };

  if (isLoading) {
    return (
      <Screen>
        <BrandHeader showBack title="Product" />
        <ScrollView contentContainerStyle={styles.body}>
          <EmptyState
            icon="restaurant-outline"
            message="Fetching this item from the shop…"
            title="Loading…"
          />
        </ScrollView>
      </Screen>
    );
  }

  if (isError || !product) {
    return (
      <Screen>
        <BrandHeader showBack title="Product" />
        <ScrollView contentContainerStyle={styles.body}>
          <EmptyState
            action={
              <View style={styles.emptyActions}>
                <Button label="Try again" onPress={() => void refetch()} />
                <Link asChild href="/(tabs)">
                  <Pressable style={styles.backLink}>
                    <Text style={styles.backLinkLabel}>Back to menu</Text>
                  </Pressable>
                </Link>
              </View>
            }
            icon="alert-circle-outline"
            message="This item may have been removed, or the connection dropped."
            title="Item not found"
          />
        </ScrollView>
      </Screen>
    );
  }

  const uri = resolveImageUrl(product.imageUrl);
  const isSvg = product.imageUrl.toLowerCase().endsWith('.svg');

  return (
    <Screen>
      <BrandHeader showBack title="Product" />
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.imageWrap}>
            {imageFailed ? (
              <View style={styles.imageFallback}>
                <Text style={styles.imageFallbackText}>NaijaBites</Text>
              </View>
            ) : isSvg ? (
              <SvgUri
                height={220}
                onError={() => setImageFailed(true)}
                uri={uri}
                width={340}
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

          <View style={styles.details}>
            <Text style={styles.name}>{product.name}</Text>
            <View style={styles.pricePill}>
              <Text style={styles.price}>{formatNaira(product.priceKobo)}</Text>
            </View>
            <Text style={styles.description}>{product.description}</Text>

            <Text style={styles.stepperLabel}>Quantity</Text>
            <View style={styles.stepper}>
              <Pressable
                accessibilityLabel="Decrease quantity"
                accessibilityRole="button"
                disabled={quantity <= 1}
                hitSlop={12}
                onPress={() => step(-1)}
                style={styles.stepButton}
              >
                <Ionicons
                  color={quantity <= 1 ? colors.inkFaint : colors.brand}
                  name="remove"
                  size={22}
                />
              </Pressable>
              <Text style={styles.stepValue}>{quantity}</Text>
              <Pressable
                accessibilityLabel="Increase quantity"
                accessibilityRole="button"
                disabled={quantity >= MAX_CART_QUANTITY}
                hitSlop={12}
                onPress={() => step(1)}
                style={styles.stepButton}
              >
                <Ionicons
                  color={quantity >= MAX_CART_QUANTITY ? colors.inkFaint : colors.brand}
                  name="add"
                  size={22}
                />
              </Pressable>
            </View>

            <Button
              label={
                justAdded
                  ? 'Added ✓'
                  : `Add ${quantity} to cart · ${formatNaira(product.priceKobo * quantity)}`
              }
              onPress={handleAdd}
            />

            <View style={styles.perks}>
              <Text style={styles.perk}>Prepared fresh on the day of delivery</Text>
              <Text style={styles.perk}>Same-day delivery across Lagos (selected areas)</Text>
              <Text style={styles.perk}>Carefully packed so it stays fresh on the way</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  emptyActions: {
    gap: spacing.sm,
    alignSelf: 'stretch',
  },
  backLink: {
    minHeight: 48,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backLinkLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.brand,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    ...shadows.card,
  },
  imageWrap: {
    height: 220,
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
  },
  imageFallbackText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.brand,
  },
  details: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  name: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    color: colors.brand,
  },
  pricePill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.gold,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  price: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
  },
  description: {
    ...typography.body,
    color: colors.inkSoft,
  },
  stepperLabel: {
    ...typography.bodyBold,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  stepButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.brand,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.ink,
    minWidth: 40,
    textAlign: 'center',
  },
  perks: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  perk: {
    ...typography.small,
  },
});