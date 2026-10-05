import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { BrandHeader } from '@/components/brand-header';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { formatNaira } from '@/lib/api';
import { useCart } from '@/lib/cart-context';
import { useProduct, useProducts } from '@/lib/products';
import { colors, radius, shadows, spacing, typography } from '@/theme';

/**
 * Cart, P3 (FR-M3.x). Signed out it renders the AsyncStorage guest cart;
 * signed in it renders the server cart both platforms share — same lines,
 * steppers, totals either way. Polling + sync indicator arrive in P4.
 */
export default function CartScreen() {
  const { lines, hydrated, signedIn, setQuantity, removeItem, clearCart } = useCart();
  const { data: products } = useProducts();

  const priceBySlug = new Map((products ?? []).map((p) => [p.slug, p.priceKobo]));
  const totalKobo = lines.reduce(
    (sum, line) => sum + (priceBySlug.get(line.slug) ?? 0) * line.quantity,
    0,
  );

  if (!hydrated) {
    return (
      <Screen>
        <BrandHeader title="Your basket" />
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <EmptyState
            icon="basket-outline"
            message="Loading your basket…"
            title="One moment"
          />
        </ScrollView>
      </Screen>
    );
  }

  if (lines.length === 0) {
    return (
      <Screen>
        <BrandHeader title="Your basket" />
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <EmptyState
            icon="basket-outline"
            message={
              signedIn
                ? 'Your synced basket is empty — add something and it appears on the website too.'
                : 'Add something from the menu — sign in and it follows you to the website and back.'
            }
            title="Your basket is empty"
          />
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <BrandHeader title={signedIn ? 'Your basket · synced' : 'Your basket'} />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {lines.map((line) => (
          <CartRow
            key={line.slug}
            onRemove={() => removeItem(line.slug)}
            onSetQuantity={(quantity) => setQuantity(line.slug, quantity)}
            quantity={line.quantity}
            slug={line.slug}
          />
        ))}
        <View style={styles.totalCard}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatNaira(totalKobo)}</Text>
          </View>
          <Text style={styles.totalNote}>Checkout stays on the website in this lesson.</Text>
        </View>
        <Button label="Clear basket" onPress={clearCart} variant="outline" />
      </ScrollView>
    </Screen>
  );
}

function CartRow({
  slug,
  quantity,
  onSetQuantity,
  onRemove,
}: {
  slug: string;
  quantity: number;
  onSetQuantity: (quantity: number) => void;
  onRemove: () => void;
}) {
  const { product } = useProduct(slug);

  return (
    <View style={styles.row}>
      <View style={styles.rowInfo}>
        <Text style={styles.rowName}>{product?.name ?? slug}</Text>
        {product ? (
          <Text style={styles.rowPrice}>{formatNaira(product.priceKobo)} each</Text>
        ) : null}
      </View>
      <View style={styles.stepper}>
        <Pressable
          accessibilityLabel="Decrease quantity"
          accessibilityRole="button"
          disabled={quantity <= 1}
          hitSlop={12}
          onPress={() => onSetQuantity(quantity - 1)}
          style={styles.stepButton}
        >
          <Ionicons
            color={quantity <= 1 ? colors.inkFaint : colors.brand}
            name="remove"
            size={20}
          />
        </Pressable>
        <Text style={styles.stepValue}>{quantity}</Text>
        <Pressable
          accessibilityLabel="Increase quantity"
          accessibilityRole="button"
          disabled={quantity >= 20}
          hitSlop={12}
          onPress={() => onSetQuantity(quantity + 1)}
          style={styles.stepButton}
        >
          <Ionicons
            color={quantity >= 20 ? colors.inkFaint : colors.brand}
            name="add"
            size={20}
          />
        </Pressable>
      </View>
      <Pressable
        accessibilityLabel="Remove from basket"
        accessibilityRole="button"
        hitSlop={12}
        onPress={onRemove}
        style={styles.removeButton}
      >
        <Ionicons color={colors.inkFaint} name="trash-outline" size={20} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 2,
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.card,
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.ink,
  },
  rowPrice: {
    ...typography.small,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.brand,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.ink,
    minWidth: 28,
    textAlign: 'center',
  },
  removeButton: {
    padding: spacing.xs,
  },
  totalCard: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: spacing.xs,
    ...shadows.card,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  totalLabel: {
    ...typography.heading,
  },
  totalValue: {
    ...typography.price,
    fontSize: 20,
  },
  totalNote: {
    ...typography.small,
  },
});
