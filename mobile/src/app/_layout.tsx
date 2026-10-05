import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { AuthProvider } from '@/lib/auth-context';
import { colors } from '@/theme';

void SplashScreen.preventAutoHideAsync();

/**
 * One client for the whole app. React Query owns server state from P2 on
 * (PRD-LESSON3 §5); module scope keeps it stable across root re-renders.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/** Light-only: dark mode is out of scope (PRD-LESSON3 §2). */
const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.brand,
    background: colors.cream,
    card: colors.white,
  },
};

export default function RootLayout() {
  useEffect(() => {
    // No custom fonts in P0 — reveal the app as soon as the tree is mounted.
    void SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider value={navTheme}>
          {/* Light icons: the status bar sits over the green brand header. */}
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.cream },
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="product/[slug]" />
            <Stack.Screen name="sign-in" options={{ presentation: 'modal' }} />
          </Stack>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
