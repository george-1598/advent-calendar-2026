import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useUnlocks } from './unlocks';
import { useAuth } from './auth';
import { supabase } from './supabase';

export type ThemeId = 'classic' | 'presents' | 'carousel' | 'books' | 'scratch' | 'village' | 'ornaments' | 'mailroom' | 'crackers' | 'musicbox';

export const THEMES: { id: ThemeId; name: string; description: string; headerColor: string }[] = [
  {
    id: 'classic',
    name: 'Classic grid',
    description: 'Bold colour blocks, clean and modern',
    headerColor: '#FFFFFF',
  },
  {
    id: 'presents',
    name: 'Wrapped presents',
    description: 'A pile of hand-wrapped gifts to unwrap',
    headerColor: '#FFFFFF',
  },
  {
    id: 'carousel',
    name: 'Carousel',
    description: 'A turning drum of drawers under a snow globe',
    headerColor: '#0B2318',
  },
  {
    id: 'books',
    name: 'Bookshelf',
    description: 'Find the right book, then flip through its pages',
    headerColor: '#24170F',
  },
  {
    id: 'scratch',
    name: 'Scratch cards',
    description: 'Scratch the gold foil to reveal the numbers',
    headerColor: '#3A0A13',
  },
  {
    id: 'village',
    name: 'Village at night',
    description: 'Light up windows to find the hidden numbers',
    headerColor: '#0A1430',
  },
  {
    id: 'ornaments',
    name: 'Tree ornaments',
    description: 'Tilt your phone to roll the ornaments into view',
    headerColor: '#121733',
  },
  {
    id: 'mailroom',
    name: 'Santa’s mailroom',
    description: 'Dig through the letters and tear one open',
    headerColor: '#24170F',
  },
  {
    id: 'crackers',
    name: 'Christmas crackers',
    description: 'Pull a cracker — bang! — to see what’s inside',
    headerColor: '#151A2E',
  },
  {
    id: 'musicbox',
    name: 'Music box',
    description: 'Wind the key and the drawers pop open',
    headerColor: '#1D1424',
  },
];

const STORAGE_KEY = 'advent-theme';
const isThemeId = (value: unknown): value is ThemeId => THEMES.some((t) => t.id === value);

function initialTheme(): ThemeId {
  // In development ?theme=presents in the URL wins (handy for previews), then the saved choice.
  const fromUrl = new URLSearchParams(window.location.search).get('theme');
  if (import.meta.env.DEV && isThemeId(fromUrl)) return fromUrl;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isThemeId(stored)) return stored;
  } catch {
    // storage unavailable (private mode etc.) — fall back to the default
  }
  return 'classic';
}

interface ThemeState {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
}

const ThemeContext = createContext<ThemeState>({ theme: 'classic', setTheme: () => {} });

// Local development only: ?theme=… previews any theme, even locked ones.
const devOverride = import.meta.env.DEV && new URLSearchParams(window.location.search).has('theme');

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [chosen, setChosen] = useState<ThemeId>(initialTheme);
  const { isUnlocked } = useUnlocks();
  // A locked theme (e.g. saved on another device before a reset) falls back to Classic.
  const theme: ThemeId = devOverride || isUnlocked(chosen) ? chosen : 'classic';
  const setTheme = (t: ThemeId) => {
    if (devOverride || isUnlocked(t)) setChosen(t);
  };

  // Presence for the admin dashboard: last seen + current theme.
  const { session } = useAuth();
  const signedIn = Boolean(session?.user?.id);
  useEffect(() => {
    if (signedIn) void supabase.rpc('touch_presence', { p_theme: theme });
  }, [signedIn, theme]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', THEMES.find((t) => t.id === theme)!.headerColor);
    try {
      localStorage.setItem(STORAGE_KEY, chosen);
    } catch {
      // ignore
    }
  }, [theme, chosen]);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
