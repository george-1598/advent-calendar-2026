import { useCallback, useEffect, useState } from 'react';
import { useNow } from '../../lib/useNow';
import { formatCountdown, isToday, isUnlocked, unlockAt } from '../../lib/time';
import { useAuth } from '../../lib/auth';
import { useProgress } from '../../lib/progress';
import DayModal from '../DayModal';

export interface DayState {
  day: number;
  unlocked: boolean;
  today: boolean;
  solved: boolean;
  /** Unlocked, or the viewer is an admin previewing. */
  canOpen: boolean;
}

/**
 * Behaviour shared by every calendar theme: unlock state, the "locked" toast
 * and shake, and the day modal. Themes only decide how days look and animate.
 */
export function useCalendarController() {
  const now = useNow();
  const { profile } = useAuth();
  const { byDay } = useProgress();
  const isAdmin = Boolean(profile?.is_admin);

  const [openDay, setOpenDay] = useState<{ day: number; color: string } | null>(null);
  const [shakingDay, setShakingDay] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(id);
  }, [toast]);

  const stateOf = (day: number): DayState => {
    const unlocked = isUnlocked(day, now);
    return {
      day,
      unlocked,
      today: isToday(day, now),
      solved: Boolean(byDay[day]?.solved_at),
      canOpen: unlocked || isAdmin,
    };
  };

  const rejectLocked = (day: number) => {
    setShakingDay(day);
    window.setTimeout(() => setShakingDay(null), 450);
    setToast(`Day ${day} opens in ${formatCountdown(unlockAt(day) - now)}`);
  };

  /** Show a short message in the toast. */
  const notify = useCallback((message: string) => setToast(message), []);

  const open = useCallback((day: number, color: string) => setOpenDay({ day, color }), []);
  const close = useCallback(() => setOpenDay(null), []);

  const overlays = (
    <>
      <div className={toast ? 'toast toast--show' : 'toast'} role="status" aria-live="polite">
        {toast}
      </div>
      {openDay && <DayModal day={openDay.day} color={openDay.color} onClose={close} />}
    </>
  );

  return {
    now,
    stateOf,
    rejectLocked,
    notify,
    open,
    shakingDay,
    /** Day whose modal is currently open, or null. */
    openDay: openDay?.day ?? null,
    overlays,
  };
}

export type CalendarController = ReturnType<typeof useCalendarController>;

export const ariaStatus = (s: DayState) =>
  s.solved ? ', solved' : !s.unlocked ? ', locked' : s.today ? ', today' : '';
