import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { BrandHeader } from '@/components/brand-header';
import { Screen } from '@/components/screen';
import { spacing, typography } from '@/theme';

/**
 * Product detail (FR-M2.2). The dynamic route and back affordance are live;
 * description, ₦ price and the quantity stepper populate in P2.
 */
export default function ProductDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();

  return (
    <Screen>
      <BrandHeader showBack title="Product" />
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.slug}>{slug}</Text>
        <Text style={styles.meta}>
          Product details and ordering appear here once the menu is loaded.
        </Text>
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
  slug: {
    ...typography.title,
  },
  meta: {
    ...typography.small,
  },
});