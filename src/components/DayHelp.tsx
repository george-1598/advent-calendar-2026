import { useState } from 'react';
import { GIVE_UP_AFTER, useProgress, type DayProgress } from '../lib/progress';

/** Unlocked hints (one per 3 wrong tries), when the next one comes, and — after 10 tries — giving up. */
export default function DayHelp({ day, progress }: { day: number; progress?: DayProgress }) {
  const { giveUp } = useProgress();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!progress || progress.solved_at) return null;
  const attempts = progress.attempts ?? 0;
  const hints = (progress.hint ?? '').split('\n').filter((h) => h.trim());
  const total = progress.hint_count ?? hints.length;
  const nextIn = hints.length < total ? (hints.length + 1) * 3 - attempts : null;
  const canGiveUp = attempts >= GIVE_UP_AFTER;

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await giveUp(day);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setBusy(false);
    }
  };

  if (!hints.length && !canGiveUp && (nextIn === null || attempts === 0)) return null;
  return (
    <div className="day-help">
      {hints.map((h, i) => (
        <p key={i} className="day-hint">
          <strong>{total > 1 ? `Hint ${i + 1}:` : 'Hint:'}</strong> {h}
        </p>
      ))}
      {nextIn !== null && nextIn > 0 && attempts > 0 && (
        <p className="day-help-next">
          {hints.length ? 'Another hint' : 'A hint'} unlocks after {nextIn} more wrong {nextIn === 1 ? 'try' : 'tries'}.
        </p>
      )}
      {canGiveUp &&
        (confirm ? (
          <div className="day-giveup">
            <p>
              Show the answer and open the gift? The day counts as done, but its badge will be grey.
            </p>
            {error && <p className="form-error">{error}</p>}
            <div className="game-row">
              <button className="game-secondary" onClick={() => setConfirm(false)} disabled={busy}>
                Keep trying
              </button>
              <button className="game-primary" onClick={run} disabled={busy}>
                {busy ? 'Opening…' : 'Show me'}
              </button>
            </div>
          </div>
        ) : (
          <button className="day-giveup-btn" onClick={() => setConfirm(true)}>
            🏳️ I give up, show me the answer
          </button>
        ))}
    </div>
  );
}
