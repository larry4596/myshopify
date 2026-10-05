import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BrandHeader } from '@/components/brand-header';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { ProductCard } from '@/components/product-card';
import { Screen } from '@/components/screen';
import { isApiConfigured } from '@/lib/config';
import { useProducts } from '@/lib/products';
import { colors, spacing, typography } from '@/theme';

/**
 * Home — the menu (FR-M2.1). Lists every active product with image, name,
 * server ₦ price and "Add to cart". Signed-out browsing is fully supported
 * (FR-M2.4); the basket stays local until P3/P4.
 */
export default function HomeScreen() {
  const { data, isLoading, isError, refetch, isRefetching } = useProducts();

  const renderBody = () => {
    if (!isApiConfigured) {
      return (
        <EmptyState
          icon="cloud-offline-outline"
          message="Copy mobile/.env.example to mobile/.env and set EXPO_PUBLIC_API_BASE_URL."
          title="Menu is not configured"
        />
      );
    }

    if (isLoading) {
      return (
        <EmptyState
          icon="restaurant-outline"
          message="Fetching today's menu from the shop…"
          title="Loading the menu…"
        />
      );
    }

    if (isError || !data) {
      return (
        <EmptyState
          action={<Button label="Try again" onPress={() => void refetch()} />}
          icon="alert-circle-outline"
          message="Could not reach NaijaBites. Check your connection and try again."
          title="Menu unavailable"
        />
      );
    }

    if (data.length === 0) {
      return (
        <EmptyState
          icon="restaurant-outline"
          message="Check back soon — fresh batches land regularly."
          title="Nothing on the menu yet"
        />
      );
    }

    return (
      <View style={styles.list}>
        {data.map((product) => (
          <ProductCard key={product.slug} product={product} />
        ))}
        <Text style={styles.count}>
          {data.length} {data.length === 1 ? 'item' : 'items'} ·{' '}
          <Text style={styles.countAccent}>prices in ₦</Text>
        </Text>
      </View>
    );
  };

  return (
    <Screen>
      <BrandHeader />
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl onRefresh={() => void refetch()} refreshing={isRefetching} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Homemade Nigerian snacks</Text>
          <Text style={styles.heroSubtitle}>
            Fresh from the kitchen — order on the app or the website, one basket.
          </Text>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>LAGOS · MADE TO ORDER</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Our menu</Text>

        {renderBody()}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 2,
    gap: spacing.lg,
  },
  hero: {
    backgroundColor: colors.brand,
    borderRadius: 16,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  heroTitle: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    color: colors.white,
  },
  heroSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.gold,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    marginTop: spacing.xs,
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: 0.8,
  },
  sectionTitle: {
    ...typography.title,
    fontSize: 20,
    lineHeight: 26,
  },
  list: {
    gap: spacing.md,
  },
  count: {
    ...typography.small,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  countAccent: {
    fontWeight: '700',
    color: colors.brand,
  },
});
