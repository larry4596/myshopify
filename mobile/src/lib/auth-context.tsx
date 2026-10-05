import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { setAuthToken, setUnauthorizedHandler } from './api';
import { clearSession, readSession, writeSession } from './session-store';
import type { MobileUser } from './types';

/**
 * The one place the app knows whether someone is signed in.
 *
 * `status` starts at 'loading' and only leaves it once SecureStore has been
 * read, so a cold start never flashes the signed-out UI at a signed-in user
 * (FR-M1.4).
 */
export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

interface AuthContextValue {
  status: AuthStatus;
  user: MobileUser | null;
  /** Stores the session minted by POST /api/mobile/auth/exchange (P1). */
  setSession: (session: { token: string; user: MobileUser }) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<MobileUser | null>(null);

  useEffect(() => {
    let cancelled = false;

    void readSession().then((session) => {
      if (cancelled) return;
      if (session) {
        setAuthToken(session.token);
        setUser(session.user);
        setStatus('signedIn');
      } else {
        setStatus('signedOut');
      }
    });

    // FR-M1.5: any 401 anywhere in the API clears the session. The screens
    // react to `status`, so a stale token degrades to signed-out UI instead
    // of hanging on a spinner.
    setUnauthorizedHandler(() => {
      setUser(null);
      setStatus('signedOut');
      void clearSession();
    });

    return () => {
      cancelled = true;
      setUnauthorizedHandler(null);
    };
  }, []);

  const setSession = useCallback(async (session: { token: string; user: MobileUser }) => {
    await writeSession(session);
    setAuthToken(session.token);
    setUser(session.user);
    setStatus('signedIn');
  }, []);

  const signOut = useCallback(async () => {
    await clearSession();
    setAuthToken(null);
    setUser(null);
    setStatus('signedOut');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, setSession, signOut }),
    [status, user, setSession, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
