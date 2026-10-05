import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';

interface BrandHeaderProps {
  /** Optional small caption under the wordmark, e.g. "Your basket". */
  title?: string;
  /** Shows a back chevron. Stack screens only — tabs have nothing to pop. */
  showBack?: boolean;
  /** Slot on the right (sync indicator, badge, …). */
  right?: ReactNode;
}

/**
 * The deep-green brand bar every screen wears. It pads itself with the top
 * safe-area inset so the green extends behind the status bar (whose icons we
 * set to light), instead of leaving a cream strip above it.
 */
export function BrandHeader({ title, showBack, right }: BrandHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
      {showBack ? (
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => router.back()}
          style={styles.back}
        >
          <Ionicons color={colors.white} name="chevron-back" size={26} />
        </Pressable>
      ) : null}

      <View style={styles.identity}>
        <Text style={styles.wordmark}>
          Naija<Text style={styles.wordmarkAccent}>Bites</Text>
        </Text>
        {title ? <Text style={styles.caption}>{title}</Text> : null}
      </View>

      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  back: {
    marginLeft: -spacing.xs,
    marginRight: spacing.sm,
  },
  identity: {
    flex: 1,
  },
  wordmark: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: 0.2,
  },
  wordmarkAccent: {
    color: colors.gold,
  },
  caption: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  right: {
    marginLeft: spacing.sm,
  },
});
