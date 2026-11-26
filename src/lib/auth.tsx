import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export interface Profile {
  id: string;
  display_name: string;
  is_admin: boolean;
  /** Creator role: pending / approved / declined, or null for a plain player. */
  creator_status?: 'pending' | 'approved' | 'declined' | null;
}

/** Creators can make a calendar for friends (admins always can). */
export const isCreator = (p: Profile | null | undefined) => Boolean(p?.is_admin || p?.creator_status === 'approved');

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  /** Reload the profile (e.g. after asking to become a creator). */
  refreshProfile: () => void;
}

const AuthContext = createContext<AuthState>({ session: null, profile: null, loading: true, refreshProfile: () => undefined });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;
  const [profileTick, setProfileTick] = useState(0);
  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    supabase
      .from('profiles')
      .select('id, display_name, is_admin, creator_status')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setProfile(data);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, profileTick]);

  // Local development only: ?nologin&admin previews the admin pages.
  const devParams = new URLSearchParams(window.location.search);
  const devProfile: Profile | null = !import.meta.env.DEV
    ? null
    : devParams.has('admin')
      ? { id: 'dev', display_name: 'Dev', is_admin: true }
      : devParams.has('player')
        ? { id: 'dev', display_name: 'Dev', is_admin: false, creator_status: (devParams.get('player') || null) as Profile['creator_status'] }
        : null;

  return (
    <AuthContext.Provider value={{ session, profile: profile ?? devProfile, loading, refreshProfile: () => setProfileTick((n) => n + 1) }}>{children}</AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

/**
 * Sign out reliably. Supabase's own sign-out can fail quietly (a bad connection)
 * or hang (its session lock on mobile), leaving you signed in, so: sign out on
 * this device only, give up waiting after 3 s, clear the saved session ourselves,
 * and reload to the sign-in page.
 */
export async function signOut() {
  try {
    await Promise.race([supabase.auth.signOut({ scope: 'local' }), new Promise((resolve) => setTimeout(resolve, 3000))]);
  } catch {
    // carry on: the session is cleared below anyway
  }
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('sb-') && k.includes('auth-token'))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
  window.location.replace(`${window.location.pathname}${window.location.search}#/`);
  window.location.reload();
}
