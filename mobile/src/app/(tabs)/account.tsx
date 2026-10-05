import { router } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BrandHeader } from '@/components/brand-header';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { useAuth } from '@/lib/auth-context';
import { colors, radius, shadows, spacing, typography } from '@/theme';

/**
 * Account (FR-M5.1). Reads the SecureStore-backed session: signed out it
 * offers Google sign-in, signed in it shows the profile the P1 exchange
 * returned — name, email and avatar from the same row the website uses.
 */
export default function AccountScreen() {
  const { status, user, signOut } = useAuth();

  return (
    <Screen>
      <BrandHeader title="Account" />
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        {status === 'loading' ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.brand} size="large" />
          </View>
        ) : status === 'signedOut' ? (
          <>
            <EmptyState
              action={
                <Button label="Continue with Google" onPress={() => router.push('/sign-in')} />
              }
              icon="person-circle-outline"
              message="Sign in with Google to keep one basket, one order history — on the website and on this app."
              title="You're signed out"
            />
          </>
        ) : (
          <>
            <View style={styles.profile}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(user?.name ?? '?').charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.name}>{user?.name}</Text>
              <Text style={styles.email}>{user?.email}</Text>
              <Button
                label="Sign out"
                onPress={() => void signOut()}
                style={styles.signOut}
                variant="outline"
              />
            </View>
          </>
        )}
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
  center: {
    alignItems: 'center',
    paddingVertical: spacing.xxl * 2,
  },
  profile: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.xs,
    ...shadows.card,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.gold,
  },
  name: {
    ...typography.heading,
    textAlign: 'center',
  },
  email: {
    ...typography.small,
    textAlign: 'center',
  },
  signOut: {
    marginTop: spacing.lg,
    alignSelf: 'stretch',
  },
});