import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

/**
 * Every screen sits on this: cream background, full height, no navigator
 * chrome (PRD-LESSON3 §8.6 hides headers app-wide, so each screen owns it).
 *
 * Deliberately NOT a SafeAreaView: <BrandHeader /> extends under the status
 * bar so the green runs to the top edge, and it applies the inset itself.
 * Bottom insets are handled by the tab bar or by the screen's own padding.
 */
export function Screen({ children }: PropsWithChildren) {
  return <View style={styles.screen}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
  },
});
