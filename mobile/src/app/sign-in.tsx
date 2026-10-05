import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BrandHeader } from '@/components/brand-header';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { runGoogleSignIn } from '@/lib/auth-flow';
import { useAuth } from '@/lib/auth-context';
import { colors, radius, shadows, spacing, typography } from '@/theme';

/**
 * Branded Google sign-in (FR-M1.1–M1.3) — the browser flow of PRD §4.
 *
 * "Continue with Google" opens the store's own Auth.js login in a Chrome
 * Custom Tab (expo-web-browser.openAuthSessionAsync). The server hands back a
 * 60-second single-use code via the app's deep-link scheme, the code is
 * exchanged for a 30-day token, and the token lands in SecureStore. The app
 * never holds a Google client id and never renders a WebView.
 */
export default function SignInScreen() {
  const { setSession } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);

    const outcome = await runGoogleSignIn();
    if (outcome.ok) {
      await setSession(outcome.session);
      // Return to wherever the user came from (account screen or a deep link).
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/');
      }
    } else {
      setError(outcome.message);
    }
    setBusy(false);
  };

  return (
    <Screen>
      <BrandHeader showBack title="Sign in" />
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.googleBadge}>
            <Text style={styles.googleG}>G</Text>
          </View>

          <Text style={styles.title}>Sign in to sync your basket</Text>
          <Text style={styles.subtitle}>
            One Google account connects this app and the NaijaBites website — one
            basket on every device.
          </Text>

          <Button
            label="Continue with Google"
            loading={busy}
            onPress={() => void handleSignIn()}
            style={styles.button}
          />
          <Text style={error ? styles.error : styles.footnote}>
            {error ??
              'Opens Google in your browser — the same account you use on the website.'}
          </Text>
        </View>
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
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    ...shadows.card,
  },
  googleBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleG: {
    fontSize: 30,
    fontWeight: '800',
    color: '#4285F4',
  },
  title: {
    ...typography.heading,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.small,
    textAlign: 'center',
  },
  button: {
    alignSelf: 'stretch',
    marginTop: spacing.sm,
  },
  footnote: {
    ...typography.small,
    textAlign: 'center',
  },
  error: {
    ...typography.small,
    textAlign: 'center',
    // Status colour, deliberately outside the brand palette: an error must
    // read as an error, not as decoration.
    color: '#B3261E',
  },
});