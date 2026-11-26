import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';

/** The organiser's calendar, which everyone plays. */
export const MAIN_CALENDAR = '00000000-0000-0000-0000-000000000001';

export interface CalendarInfo {
  id: string;
  title: string;
  is_main: boolean;
  /** The signed-in user made this calendar (they can preview and edit it). */
  is_owner: boolean;
  owner_name: string | null;
}

interface CalendarsState {
  calendars: CalendarInfo[];
  /** The calendar being viewed. */
  current: CalendarInfo;
  currentId: string;
  /** The viewer can edit the current calendar (and open its days early). */
  canEdit: boolean;
  select: (id: string) => void;
  refresh: () => void;
}

const STORE_KEY = 'advent-calendar';
const MAIN_INFO: CalendarInfo = { id: MAIN_CALENDAR, title: 'Advent Calendar 2026', is_main: true, is_owner: false, owner_name: null };

/** "🎁 From Maria", "✏️ My calendar", or the main calendar's title. */
export function calendarLabel(c: CalendarInfo): string {
  if (c.is_main) return `🎄 ${c.title}`;
  if (c.is_owner) return '✏️ My calendar';
  return `🎁 From ${c.owner_name ?? 'a friend'}`;
}

const CalendarsContext = createContext<CalendarsState | null>(null);

export function CalendarsProvider({ children }: { children: ReactNode }) {
  const { session, profile } = useAuth();
  const userId = session?.user.id;
  const [calendars, setCalendars] = useState<CalendarInfo[]>([MAIN_INFO]);
  const [loaded, setLoaded] = useState(false);
  const [currentId, setCurrentId] = useState<string>(() => {
    try {
      return localStorage.getItem(STORE_KEY) ?? MAIN_CALENDAR;
    } catch {
      return MAIN_CALENDAR;
    }
  });

  // Local development only (?nologin): load calendars without a session so they can be previewed.
  const devPreview = import.meta.env.DEV && new URLSearchParams(window.location.search).has('nologin');
  const refresh = useCallback(() => {
    if (!userId && !devPreview) {
      setCalendars([MAIN_INFO]);
      return;
    }
    supabase.rpc('get_my_calendars').then(({ data, error }) => {
      const list = !error && Array.isArray(data) && data.length ? (data as CalendarInfo[]) : [MAIN_INFO];
      setCalendars(list);
      setLoaded(true);
    });
  }, [userId, devPreview]);

  useEffect(refresh, [refresh]);

  const select = useCallback((id: string) => {
    setCurrentId(id);
    try {
      localStorage.setItem(STORE_KEY, id);
    } catch {
      // ignore
    }
  }, []);

  // A remembered calendar the user can no longer see falls back to the main one.
  useEffect(() => {
    if (loaded && !calendars.some((c) => c.id === currentId)) select(MAIN_CALENDAR);
  }, [loaded, calendars, currentId, select]);

  const current = calendars.find((c) => c.id === currentId) ?? { ...MAIN_INFO, id: currentId, is_main: currentId === MAIN_CALENDAR };
  const canEdit = current.is_main ? Boolean(profile?.is_admin) : current.is_owner;

  const value = useMemo(
    () => ({ calendars, current, currentId, canEdit, select, refresh }),
    [calendars, current, currentId, canEdit, select, refresh],
  );
  return <CalendarsContext.Provider value={value}>{children}</CalendarsContext.Provider>;
}

export function useCalendars(): CalendarsState {
  const ctx = useContext(CalendarsContext);
  if (!ctx) throw new Error('useCalendars must be used inside CalendarsProvider');
  return ctx;
}
