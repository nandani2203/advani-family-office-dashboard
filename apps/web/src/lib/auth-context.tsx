'use client';

import { useRouter } from 'next/navigation';
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { api, setSessionExpiredHandler, tokens } from './api-client';
import type { ApiUser, Role, Session } from './types';

interface AuthState {
  user: ApiUser | null;
  /** True until the stored token has been checked against the API. */
  loading: boolean;
  signIn: (session: Session) => void;
  signOut: () => Promise<void>;
  can: (...roles: Role[]) => boolean;
  /** Shorthand for the two roles that may write business data. */
  canEdit: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const router = useRouter();
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);
  // Guards against a redirect loop if two components notice the expiry at once.
  const expiring = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const restore = async (): Promise<void> => {
      if (!tokens.access() && !tokens.refresh()) {
        setLoading(false);
        return;
      }

      try {
        const me = await api.get<ApiUser>('/auth/me');
        if (!cancelled) setUser(me);
      } catch {
        // A dead token is not an error worth showing — the login screen is the
        // answer, and the API client has already cleared storage.
        tokens.clear();
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      if (expiring.current) return;
      expiring.current = true;
      setUser(null);
      router.replace('/login?expired=1');
    });

    return () => setSessionExpiredHandler(null);
  }, [router]);

  const signIn = useCallback((session: Session) => {
    tokens.save(session);
    setUser(session.user);
    expiring.current = false;
  }, []);

  const signOut = useCallback(async () => {
    const refreshToken = tokens.refresh();

    try {
      await api.post('/auth/logout', refreshToken ? { refreshToken } : {});
    } catch {
      // Signing out locally must succeed even if the API call does not.
    }

    tokens.clear();
    setUser(null);
    router.replace('/login');
  }, [router]);

  const value = useMemo<AuthState>(() => {
    const can = (...roles: Role[]): boolean => Boolean(user && roles.includes(user.role));

    return {
      user,
      loading,
      signIn,
      signOut,
      can,
      canEdit: can('ADMIN', 'EDITOR'),
      isAdmin: can('ADMIN'),
    };
  }, [user, loading, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider.');
  return context;
}
