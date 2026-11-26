import type { DayState } from './controller';

/** Small 🛠️ badge on a day that's open but not filled in yet. */
export function PendingMark({ state, className = '' }: { state: DayState; className?: string }) {
  if (!state.pending) return null;
  return (
    <span className={`pending-mark ${className}`} title="Still being prepared" aria-hidden>
      🛠️
    </span>
  );
}

/** One line for a theme's "open this day" panel. */
export function PendingNote({ state }: { state: DayState }) {
  if (!state.pending) return null;
  return <p className="pending-note">🛠️ Still being prepared, check back soon</p>;
}
