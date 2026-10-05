import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadows, spacing, typography } from '@/theme';

interface EmptyStateProps {
  icon?: ComponentProps<typeof Ionicons>['name'];
  title: string;
  message?: string;
  /** Optional action node, e.g. <Button … /> */
  action?: ReactNode;
}

/** White card on cream for "there's nothing here yet" states. */
export function EmptyState({ icon = 'basket-outline', title, message, action }: EmptyStateProps) {
  return (
    <View style={styles.card}>
      <View style={styles.iconCircle}>
        <Ionicons color={colors.brand} name={icon} size={30} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.card,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.heading,
    textAlign: 'center',
  },
  message: {
    ...typography.small,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  action: {
    marginTop: spacing.lg,
    alignSelf: 'stretch',
  },
});
