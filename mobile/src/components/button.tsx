import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { colors, radius, spacing } from '@/theme';

type Variant = 'primary' | 'gold' | 'outline';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  /** Shows a spinner and blocks presses (FR-M3.5 optimistic UI). */
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

const VARIANTS: Record<
  Variant,
  { background: string; pressed: string; text: string; border: string }
> = {
  primary: {
    background: colors.brand,
    pressed: colors.brandDark,
    text: colors.white,
    border: colors.brand,
  },
  gold: {
    background: colors.gold,
    pressed: colors.goldDark,
    text: colors.ink,
    border: colors.gold,
  },
  outline: {
    background: colors.white,
    pressed: colors.brandLight,
    text: colors.brand,
    border: colors.brand,
  },
};

/** Pill button, matching the web's primary/gold/outline actions (§9). */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  const palette = VARIANTS[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: pressed && !inactive ? palette.pressed : palette.background,
          borderColor: palette.border,
          opacity: inactive ? 0.55 : 1,
        },
        pressed && !inactive && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.text} size="small" />
      ) : (
        <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
  },
});
