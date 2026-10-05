import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';

import { AuthProvider } from '@/lib/auth-context';
import { CartProvider } from '@/lib/cart-context';
import { colors } from '@/theme';

void SplashScreen.preventAutoHideAsync().catch(() => {
  // Splash may already be hidden in Expo Go — never crash the launch over it.
});

/**
 * Root layout (PRD-LESSON3 §8.6): the one place providers are composed.
 *
 *   SafeAreaProvider  — <BrandHeader /> reads the top inset for itself.
 *   QueryClientProvider — the P2 catalogue cache (`useProducts`, 60 s stale).
 *   AuthProvider      — SecureStore session (P1), restored on cold start.
 *   CartProvider      — guest basket in AsyncStorage (P2; server cart in P3/P4).
 *
 * Every scene sits on cream (`contentStyle`); individual screens hide the
 * native header and draw their own green <BrandHeader /> instead.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A retry storms a cold serverless start; one retry is enough.
      retry: 1,
      // Matches GET /api/mobile/products Cache-Control (max-age=60).
      staleTime: 60_000,
    },
  },
});

export default function RootLayout() {
  useEffect(() => {
    // No custom fonts to wait for (system stack, PRD-LESSON3 §9) — hide once
    // the first frame can mount.
    void SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <CartProvider>
            <StatusBar style="light" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.cream } }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="product/[slug]" />
              <Stack.Screen name="sign-in" options={{ presentation: 'modal' }} />
            </Stack>
          </CartProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

