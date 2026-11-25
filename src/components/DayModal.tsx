import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { TileColor } from '../data/layout';
import { supabase } from '../lib/supabase';
import { useProgress } from '../lib/progress';
import { StarIcon } from './icons';

interface Quest {
  day: number;
  title: string;
  kind: string;
  content: { prompt?: string };
}

interface Props {
  day: number;
  color: TileColor;
  onClose: () => void;
}

export default function DayModal({ day, color, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const { byDay, submit } = useProgress();
  const progress = byDay[day];
  const solved = Boolean(progress?.solved_at);

  const [quest, setQuest] = useState<Quest | null | undefined>(undefined);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [wrongPulse, setWrongPulse] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('quests')
      .select('day, title, kind, content')
      .eq('day', day)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setQuest(data as Quest | null);
      });
    return () => {
      cancelled = true;
    };
  }, [day]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!answer.trim()) return;
    setBusy(true);
    setFeedback(null);
    try {
      const result = await submit(day, answer);
      if (!result.correct) {
        setFeedback('Not quite. Try again!');
        setWrongPulse((n) => n + 1);
      }
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Something went wrong');
    }
    setBusy(false);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`modal-head tile--${color}`}>
          <span className="modal-kicker">December</span>
          <span className="modal-day">{day}</span>
          <button ref={closeRef} className="modal-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          {quest === undefined && <p className="modal-note">Opening the door…</p>}

          {quest === null && (
            <>
              <h2 id="day-title">Day {day}</h2>
              <p>The elves are still wrapping this quest. Check back soon!</p>
            </>
          )}

          {quest && (
            <>
              <h2 id="day-title">{quest.title}</h2>
              {quest.content.prompt && <p className="quest-prompt">{quest.content.prompt}</p>}

              {solved ? (
                <div className="reward">
                  <div className={`reward-badge badge--${color}`}>
                    {progress?.badge_letter ? (
                      <span className="reward-letter">{progress.badge_letter}</span>
                    ) : (
                      <StarIcon className="reward-star" />
                    )}
                  </div>
                  <span className="reward-kicker">Solved! Your surprise</span>
                  <p className="reward-text">{progress?.reward}</p>
                </div>
              ) : (
                <>
                  <form className="answer" onSubmit={onSubmit}>
                    <input
                      key={wrongPulse}
                      className={wrongPulse ? 'is-wrong' : undefined}
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder="Your answer"
                      aria-label="Your answer"
                      autoComplete="off"
                      autoCapitalize="off"
                    />
                    <button disabled={busy || !answer.trim()}>{busy ? '…' : 'Unlock'}</button>
                  </form>
                  {feedback && <p className="form-error">{feedback}</p>}
                  {progress?.hint && (
                    <p className="hint">
                      <strong>Hint:</strong> {progress.hint}
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
