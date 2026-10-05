import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BrandHeader } from '@/components/brand-header';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { colors, radius, spacing, typography } from '@/theme';

/**
 * Home — the menu (FR-M2.1). The branded shell with its hero; product cards
 * populate this screen when the catalogue is wired (P2).
 */
export default function HomeScreen() {
  return (
    <Screen>
      <BrandHeader />
      <ScrollView
        contentContainerStyle={styles.body}
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

        <EmptyState
          icon="restaurant-outline"
          message="Puff-puff, suya wings, chin-chin and more — the full NaijaBites menu shows up right here."
          title="Menu coming soon"
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
  hero: {
    backgroundColor: colors.brand,
    borderRadius: radius.card,
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
    borderRadius: radius.pill,
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
  },
});