import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type ThemeId = 'classic' | 'presents' | 'carousel';

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
];

const STORAGE_KEY = 'advent-theme';
const isThemeId = (value: unknown): value is ThemeId => THEMES.some((t) => t.id === value);

function initialTheme(): ThemeId {
  // ?theme=presents in the URL wins (handy for previews), then the saved choice.
  const fromUrl = new URLSearchParams(window.location.search).get('theme');
  if (isThemeId(fromUrl)) return fromUrl;
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

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeId>(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', THEMES.find((t) => t.id === theme)!.headerColor);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
