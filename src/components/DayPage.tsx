import { useEffect, useState, type CSSProperties } from 'react';
import Game from './games/Game';
import type { GameContent } from './games/types';
import { supabase } from '../lib/supabase';
import { useProgress } from '../lib/progress';
import { calendarLabel, useCalendars } from '../lib/calendars';
import { useNow } from '../lib/useNow';
import { TOTAL_DAYS, YEAR, formatCountdown, isUnlocked, unlockAt } from '../lib/time';
import { dayColor, goHome, openAdmin, openDayPage, openMine } from '../lib/route';
import { StarIcon, LockIcon } from './icons';

interface Quest {
  day: number;
  title: string;
  kind: string;
  content: GameContent;
}

const FALLBACK_COLOR = '#7A231C';

/** A full page for one day: hero header, the day's quest/game, and the gift once solved. */
export default function DayPage({ day, code }: { day: number; code?: string }) {
  const now = useNow();
  const { current: calendar, currentId: calendarId, canEdit } = useCalendars();
  const { byDay } = useProgress();
  const progress = byDay[day];
  const solved = Boolean(progress?.solved_at);
  const canOpen = isUnlocked(day, now) || canEdit;
  const color = dayColor() ?? FALLBACK_COLOR;
  const date = new Date(Date.UTC(YEAR, 11, day)).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });

  const [quest, setQuest] = useState<Quest | null | undefined>(undefined);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !(e.target instanceof HTMLInputElement)) goHome();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    setQuest(undefined);
    if (!canOpen) return;
    let cancelled = false;
    // The server returns this player's own version of the quest (or the default).
    supabase.rpc('get_quest', { p_day: day, p_calendar: calendarId }).then(({ data }) => {
      if (!cancelled) setQuest((data as Quest | null) ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [day, canOpen, calendarId]);

  const prev = day > 1 && (isUnlocked(day - 1, now) || canEdit) ? day - 1 : null;
  const next = day < TOTAL_DAYS && (isUnlocked(day + 1, now) || canEdit) ? day + 1 : null;

  return (
    <article className="day-page" style={{ '--day': color } as CSSProperties}>
      <header className="day-hero">
        <button className="day-back" onClick={goHome}>
          ← Back to the calendar
        </button>
        {!calendar.is_main && <span className="day-hero-calendar">{calendarLabel(calendar)}</span>}
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
          <div className="day-card day-pending">
            <span className="day-pending-icon">{calendar.is_main ? '🛠️' : '🎁'}</span>
            {canEdit ? (
              <>
                <h2>You haven’t filled in this day yet</h2>
                <p>Players see “work in progress” here until you add a quest.</p>
                <button className="game-primary" onClick={() => (calendar.is_main ? openAdmin('quests') : openMine('quests'))}>
                  Fill in December {day}
                </button>
              </>
            ) : calendar.is_main ? (
              <>
                <h2>Work in progress</h2>
                <p>The elves are still preparing December {day}. Check back soon!</p>
              </>
            ) : (
              <>
                <h2>{calendar.owner_name ?? 'Your friend'} is still preparing this one</h2>
                <p>December {day} isn’t ready yet. Check back soon!</p>
              </>
            )}
          </div>
        )}

        {canOpen && quest && (
          <div className="day-card">
            <Game key={`${calendarId}-${day}-${quest.kind}`} kind={quest.kind} day={day} content={quest.content ?? {}} solved={solved} code={code} />
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
              progress?.hint && (
                <p className="day-hint">
                  <strong>Hint:</strong> {progress.hint}
                </p>
              )
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
