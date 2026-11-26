import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';
import { useCalendars } from './calendars';

export interface DayProgress {
  day: number;
  attempts: number;
  solved_at: string | null;
  reward: string | null;
  hint: string | null;
  badge_letter: string | null;
  /** Multi-step chains: the step the player is on (0-based). */
  chain_step?: number;
}

export interface SubmitResult extends Omit<DayProgress, 'day'> {
  correct: boolean;
  /** Wordle: one letter per tile — g (right place), y (wrong place), b (not in word). */
  pattern?: string;
  /** Map pin: how far the guess was from the spot. */
  distance_m?: number;
  /** Quiz / timeline: how many were right. */
  right?: number;
  total?: number;
  /** Chains: "correct" is about this step; "solved" is about the whole day. */
  solved?: boolean;
}

/** A hint sent to the player, or a thank-you the player sent. */
export interface Note {
  id: number;
  day: number;
  kind: 'hint' | 'thanks';
  emoji: string | null;
  body: string | null;
  from_name: string | null;
  created_at: string;
  read_at: string | null;
}

interface ProgressState {
  byDay: Record<number, DayProgress>;
  solvedCount: number;
  submit: (day: number, answer: string) => Promise<SubmitResult>;
  /** Open days that already have a quest (null until loaded). Others are "work in progress". */
  ready: Set<number> | null;
  notes: Note[];
  refreshNotes: () => void;
}

const ProgressContext = createContext<ProgressState | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const { currentId: calendarId } = useCalendars();
  const [byDay, setByDay] = useState<Record<number, DayProgress>>({});
  const [ready, setReady] = useState<Set<number> | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  // Reload just the notes (after sending a thank-you or reading a hint).
  const refreshNotes = useCallback(() => {
    supabase.rpc('my_notes', { p_calendar: calendarId }).then(({ data, error }) => {
      if (!error && Array.isArray(data)) setNotes(data as Note[]);
    });
  }, [calendarId]);

  // Which open days are filled in: on load, when coming back to the app, and every few minutes,
  // so a day the creator adds later shows up without a reload.
  useEffect(() => {
    setReady(null);
    setNotes([]);
    // Local development only (?nologin): load without a session so the calendar can be previewed.
    const devPreview = import.meta.env.DEV && new URLSearchParams(window.location.search).has('nologin');
    if (!userId && !devPreview) return;
    let cancelled = false;
    const load = () => {
      supabase.rpc('ready_days', { p_calendar: calendarId }).then(({ data, error }) => {
        if (!cancelled && !error && Array.isArray(data)) setReady(new Set(data as number[]));
      });
      supabase.rpc('my_notes', { p_calendar: calendarId }).then(({ data, error }) => {
        if (!cancelled && !error && Array.isArray(data)) setNotes(data as Note[]);
      });
    };
    load();
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    const id = window.setInterval(load, 3 * 60 * 1000);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(id);
    };
  }, [userId, calendarId]);

  useEffect(() => {
    setByDay({});
    if (!userId) return;
    let cancelled = false;
    supabase.rpc('get_my_progress', { p_calendar: calendarId }).then(({ data, error }) => {
      if (cancelled || error || !data) return;
      const rows = data as DayProgress[];
      setByDay(Object.fromEntries(rows.map((row) => [row.day, row])));
    });
    return () => {
      cancelled = true;
    };
  }, [userId, calendarId]);

  const submit = useCallback(async (day: number, answer: string) => {
    const { data, error } = await supabase.rpc('submit_answer', { p_day: day, p_answer: answer, p_calendar: calendarId });
    if (error) throw new Error(error.message);
    const result = data as SubmitResult;
    setByDay((prev) => ({
      ...prev,
      [day]: {
        day,
        attempts: result.attempts,
        solved_at: result.solved_at,
        reward: result.reward,
        hint: result.hint,
        badge_letter: result.badge_letter,
        chain_step: result.chain_step,
      },
    }));
    return result;
  }, [calendarId]);

  const solvedCount = Object.values(byDay).filter((p) => p.solved_at).length;

  return (
    <ProgressContext.Provider value={{ byDay, solvedCount, submit, ready, notes, refreshNotes }}>{children}</ProgressContext.Provider>
  );
}

export function useProgress(): ProgressState {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgress must be used inside ProgressProvider');
  return ctx;
}
