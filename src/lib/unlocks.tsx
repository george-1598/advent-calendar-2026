import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from './auth';
import { supabase } from './supabase';
import type { ThemeId } from './theme';
import { playChime } from './sound';

/** Themes unlock in this order. */
export const THEME_CHAIN: ThemeId[] = [
  'classic', 'presents', 'books', 'village', 'ornaments', 'scratch', 'carousel', 'mailroom', 'crackers', 'musicbox',
];

/** The hidden "key day" in each theme; finding it unlocks the next theme. */
export const KEY_DAYS: Partial<Record<ThemeId, number>> = {
  classic: 14,
  presents: 3,
  books: 21,
  village: 9,
  ornaments: 17,
  scratch: 6,
  carousel: 12,
  mailroom: 24,
  crackers: 2,
};

export const nextTheme = (t: ThemeId): ThemeId | null => THEME_CHAIN[THEME_CHAIN.indexOf(t) + 1] ?? null;
export const previousTheme = (t: ThemeId): ThemeId | null => THEME_CHAIN[THEME_CHAIN.indexOf(t) - 1] ?? null;

export type FoundResult = 'unlocked' | 'blocked' | 'none';

interface UnlocksState {
  isUnlocked: (t: ThemeId) => boolean;
  /** Whether a theme's key still has something to unlock (so its clue should show). */
  keyActive: (t: ThemeId) => boolean;
  /**
   * Report that the user found `day` in `theme`. If it's the key day (and no
   * helper is giving things away), the next theme unlocks.
   */
  found: (theme: ThemeId, day: number, helperOn?: boolean) => FoundResult;
  justUnlocked: ThemeId | null;
  dismiss: () => void;
  unlockAll: () => Promise<void>;
}

const UnlocksContext = createContext<UnlocksState | null>(null);
const GUEST_KEY = 'advent-unlocks-guest';

export function UnlocksProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [unlocked, setUnlocked] = useState<Set<ThemeId>>(new Set(['classic']));
  const [justUnlocked, setJustUnlocked] = useState<ThemeId | null>(null);

  // Load: from the server when signed in, otherwise from this device (dev preview).
  useEffect(() => {
    let cancelled = false;
    const base = new Set<ThemeId>(['classic']);
    if (!userId) {
      try {
        (JSON.parse(localStorage.getItem(GUEST_KEY) ?? '[]') as ThemeId[]).forEach((t) => base.add(t));
      } catch {
        // ignore
      }
      setUnlocked(base);
      return;
    }
    supabase
      .from('theme_unlocks')
      .select('theme')
      .then(({ data }) => {
        if (cancelled) return;
        (data ?? []).forEach((row) => base.add(row.theme as ThemeId));
        setUnlocked(base);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const persist = useCallback(
    async (theme: ThemeId) => {
      if (userId) {
        await supabase.rpc('unlock_theme', { p_theme: theme });
      } else {
        setUnlocked((prev) => {
          try {
            localStorage.setItem(GUEST_KEY, JSON.stringify([...new Set([...prev, theme])]));
          } catch {
            // ignore
          }
          return prev;
        });
      }
    },
    [userId],
  );

  const isUnlocked = useCallback((t: ThemeId) => unlocked.has(t), [unlocked]);

  const keyActive = useCallback(
    (t: ThemeId) => {
      const next = nextTheme(t);
      return KEY_DAYS[t] !== undefined && next !== null && !unlocked.has(next);
    },
    [unlocked],
  );

  const found = useCallback(
    (theme: ThemeId, day: number, helperOn = false): FoundResult => {
      if (KEY_DAYS[theme] !== day || !keyActive(theme)) return 'none';
      if (helperOn) return 'blocked';
      const next = nextTheme(theme)!;
      setUnlocked((prev) => new Set(prev).add(next));
      void persist(next);
      window.setTimeout(() => {
        playChime();
        setJustUnlocked(next);
      }, 700);
      return 'unlocked';
    },
    [keyActive, persist],
  );

  const unlockAll = useCallback(async () => {
    for (const t of THEME_CHAIN.slice(1)) {
      setUnlocked((prev) => new Set(prev).add(t));
      await persist(t);
    }
  }, [persist]);

  return (
    <UnlocksContext.Provider
      value={{ isUnlocked, keyActive, found, justUnlocked, dismiss: () => setJustUnlocked(null), unlockAll }}
    >
      {children}
    </UnlocksContext.Provider>
  );
}

export function useUnlocks(): UnlocksState {
  const ctx = useContext(UnlocksContext);
  if (!ctx) throw new Error('useUnlocks must be used inside UnlocksProvider');
  return ctx;
}

/** The faint "🗝 N" clue each theme hides somewhere in its art. */
export function KeyClue({ theme, className = '' }: { theme: ThemeId; className?: string }) {
  const { keyActive } = useUnlocks();
  if (!keyActive(theme)) return null;
  return (
    <span className={`key-clue ${className}`} aria-hidden="true">
      🗝 {KEY_DAYS[theme]}
    </span>
  );
}

export const BLOCKED_MESSAGE = 'That’s the key 🗝 — but turn the helper off and find it yourself to unlock the next theme!';
