import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useProgress } from '../lib/progress';
import { useAuth } from '../lib/auth';
import { useNow } from '../lib/useNow';
import { TOTAL_DAYS, YEAR, formatCountdown, isUnlocked, unlockAt } from '../lib/time';
import { dayColor, goHome, openDayPage } from '../lib/route';
import { StarIcon, LockIcon } from './icons';

interface Quest {
  day: number;
  title: string;
  kind: string;
  content: { prompt?: string };
}

const FALLBACK_COLOR = '#7A231C';

/** A full page for one day: hero header, the day's quest/game, and the gift once solved. */
export default function DayPage({ day }: { day: number }) {
  const now = useNow();
  const { profile } = useAuth();
  const { byDay, submit } = useProgress();
  const progress = byDay[day];
  const solved = Boolean(progress?.solved_at);
  const canOpen = isUnlocked(day, now) || Boolean(profile?.is_admin);
  const color = dayColor() ?? FALLBACK_COLOR;
  const date = new Date(Date.UTC(YEAR, 11, day)).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });

  const [quest, setQuest] = useState<Quest | null | undefined>(undefined);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [wrongPulse, setWrongPulse] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !(e.target instanceof HTMLInputElement)) goHome();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    setQuest(undefined);
    setAnswer('');
    setFeedback(null);
    if (!canOpen) return;
    let cancelled = false;
    // The server returns this player's own version of the quest (or the default).
    supabase.rpc('get_quest', { p_day: day }).then(({ data }) => {
      if (!cancelled) setQuest((data as Quest | null) ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [day, canOpen]);

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

  const prev = day > 1 && (isUnlocked(day - 1, now) || profile?.is_admin) ? day - 1 : null;
  const next = day < TOTAL_DAYS && (isUnlocked(day + 1, now) || profile?.is_admin) ? day + 1 : null;

  return (
    <article className="day-page" style={{ '--day': color } as CSSProperties}>
      <header className="day-hero">
        <button className="day-back" onClick={goHome}>
          ← Back to the calendar
        </button>
        <span className="day-hero-kicker">December</span>
        <span className="day-hero-num">{day}</span>
        <span className="day-hero-date">{date}</span>
        {canOpen && quest && <h1 className="day-hero-title">{quest.title}</h1>}
        {solved && (
          <span className="day-hero-solved">
            <StarIcon className="day-hero-star" /> Solved
          </span>
        )}
      </header>

      <section className="day-body">
        {!canOpen && (
          <div className="day-card day-locked">
            <LockIcon className="day-locked-icon" />
            <h2>Not yet!</h2>
            <p>This door opens in {formatCountdown(unlockAt(day) - now)}.</p>
          </div>
        )}

        {canOpen && quest === undefined && <p className="day-loading">Opening the door…</p>}

        {canOpen && quest === null && (
          <div className="day-card">
            <h2>The elves are still wrapping this one</h2>
            <p>Today’s quest isn’t ready yet. Check back soon!</p>
          </div>
        )}

        {canOpen && quest && (
          <div className="day-card">
            {/* The game area: today a riddle; later each day's kind can render its own mini-game here. */}
            <div className={`day-game day-game--${quest.kind}`}>
              {quest.content.prompt && <p className="day-prompt">{quest.content.prompt}</p>}
            </div>

            {solved ? (
              <div className="day-reward">
                <div className="day-reward-badge">
                  {progress?.badge_letter ? (
                    <span className="day-reward-letter">{progress.badge_letter}</span>
                  ) : (
                    <StarIcon className="day-reward-star" />
                  )}
                </div>
                <span className="day-reward-kicker">Solved! Your surprise</span>
                <p className="day-reward-text">{progress?.reward}</p>
              </div>
            ) : (
              <>
                <form className="day-answer" onSubmit={onSubmit}>
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
                  <p className="day-hint">
                    <strong>Hint:</strong> {progress.hint}
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </section>

      <nav className="day-pager" aria-label="Other days">
        {prev ? (
          <button onClick={() => openDayPage(prev)}>← Day {prev}</button>
        ) : (
          <span />
        )}
        {next ? <button onClick={() => openDayPage(next)}>Day {next} →</button> : <span />}
      </nav>
    </article>
  );
}
