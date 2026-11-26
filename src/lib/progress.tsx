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

export interface DayProgress {
  day: number;
  attempts: number;
  solved_at: string | null;
  reward: string | null;
  hint: string | null;
  badge_letter: string | null;
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
}

interface ProgressState {
  byDay: Record<number, DayProgress>;
  solvedCount: number;
  submit: (day: number, answer: string) => Promise<SubmitResult>;
}

const ProgressContext = createContext<ProgressState | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [byDay, setByDay] = useState<Record<number, DayProgress>>({});

  useEffect(() => {
    setByDay({});
    if (!userId) return;
    let cancelled = false;
    supabase.rpc('get_my_progress').then(({ data, error }) => {
      if (cancelled || error || !data) return;
      const rows = data as DayProgress[];
      setByDay(Object.fromEntries(rows.map((row) => [row.day, row])));
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const submit = useCallback(async (day: number, answer: string) => {
    const { data, error } = await supabase.rpc('submit_answer', { p_day: day, p_answer: answer });
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
      },
    }));
    return result;
  }, []);

  const solvedCount = Object.values(byDay).filter((p) => p.solved_at).length;

  return (
    <ProgressContext.Provider value={{ byDay, solvedCount, submit }}>{children}</ProgressContext.Provider>
  );
}

export function useProgress(): ProgressState {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgress must be used inside ProgressProvider');
  return ctx;
}
