import { useCallback, useEffect, useState } from 'react';
import { useNow } from '../../lib/useNow';
import { formatCountdown, isToday, isUnlocked, unlockAt } from '../../lib/time';
import { useCalendars } from '../../lib/calendars';
import { useProgress } from '../../lib/progress';
import { openDayPage } from '../../lib/route';

export interface DayState {
  day: number;
  unlocked: boolean;
  today: boolean;
  solved: boolean;
  /** Unlocked, or the viewer is an admin previewing. */
  canOpen: boolean;
  /** Open, but its creator hasn't filled it in yet ("work in progress"). */
  pending: boolean;
}

/**
 * Behaviour shared by every calendar theme: unlock state, the "locked" toast
 * and shake, and the day modal. Themes only decide how days look and animate.
 */
export function useCalendarController() {
  const now = useNow();
  const { byDay, ready } = useProgress();
  // Admins (main calendar) and creators (their own) can preview locked days.
  const { canEdit: isAdmin } = useCalendars();

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
      pending: (unlocked || isAdmin) && ready !== null && !ready.has(day) && !byDay[day]?.solved_at,
    };
  };

  const rejectLocked = (day: number) => {
    setShakingDay(day);
    window.setTimeout(() => setShakingDay(null), 450);
    setToast(`Day ${day} opens in ${formatCountdown(unlockAt(day) - now)}`);
  };

  /** Show a short message in the toast. */
  const notify = useCallback((message: string) => setToast(message), []);

  // Days open on their own page (#/day/N); the colour tints its header.
  const open = useCallback((day: number, color: string) => openDayPage(day, color), []);

  const overlays = (
    <>
      <div className={toast ? 'toast toast--show' : 'toast'} role="status" aria-live="polite">
        {toast}
      </div>
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
    openDay: null as number | null,
    overlays,
  };
}

export type CalendarController = ReturnType<typeof useCalendarController>;

export const ariaStatus = (s: DayState) =>
  s.solved ? ', solved' : !s.unlocked ? ', locked' : s.pending ? ', still being prepared' : s.today ? ', today' : '';
