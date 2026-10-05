import { ScrollView, StyleSheet } from 'react-native';

import { BrandHeader } from '@/components/brand-header';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { spacing } from '@/theme';

/**
 * Cart (FR-M3.x, FR-M4.x). Signed-out empty state today; the synced basket,
 * steppers and sync indicator arrive with P3/P4.
 */
export default function CartScreen() {
  return (
    <Screen>
      <BrandHeader title="Your basket" />
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <EmptyState
          icon="basket-outline"
          message="Add something from the menu — it follows you to the website and back."
          title="Your basket is empty"
        />
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
});