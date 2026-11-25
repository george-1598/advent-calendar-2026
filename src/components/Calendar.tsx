import { useCallback, useEffect, useState } from 'react';
import type { View } from '../App';
import { LAYOUT, type TileColor } from '../data/layout';
import { useNow } from '../lib/useNow';
import {
  TOTAL_DAYS,
  formatCountdown,
  isToday,
  isUnlocked,
  nextUnlock,
  unlockAt,
} from '../lib/time';
import DayModal from './DayModal';
import { LockIcon } from './icons';

const INTRO_MESSAGES = [
  'A Christmas advent calendar made with love',
  '25 days · 25 quests · 25 surprises',
  'Solve each day’s quest to unlock a real gift',
];

export default function Calendar({ onNavigate }: { onNavigate: (view: View) => void }) {
  const now = useNow();
  const [openDay, setOpenDay] = useState<{ day: number; color: TileColor } | null>(null);
  const [shakingDay, setShakingDay] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(id);
  }, [toast]);

  const handleLocked = (day: number) => {
    setShakingDay(day);
    window.setTimeout(() => setShakingDay(null), 450);
    setToast(`Day ${day} opens in ${formatCountdown(unlockAt(day) - now)}`);
  };

  const closeModal = useCallback(() => setOpenDay(null), []);

  const next = nextUnlock(now);
  const introIndex = Math.floor(now / 4500) % INTRO_MESSAGES.length;

  return (
    <>
      <div className="grid-wrap">
        <div className="grid">
          {LAYOUT.map((item) => {
            switch (item.kind) {
              case 'intro':
                return (
                  <div key="intro" className="tile tile--ink span-intro intro">
                    <p className="intro-text" key={introIndex}>
                      {INTRO_MESSAGES[introIndex]}
                    </p>
                    <div className="dots" aria-hidden="true">
                      {INTRO_MESSAGES.map((_, i) => (
                        <span key={i} className={i === introIndex ? 'dot dot--on' : 'dot'} />
                      ))}
                    </div>
                  </div>
                );

              case 'logo':
                return (
                  <div key="logo" className="tile tile--paper span-wide logo">
                    <span className="logo-script">Advent</span>
                    <span className="logo-sub">Calendar 2026</span>
                  </div>
                );

              case 'countdown':
                return (
                  <div key="countdown" className="tile tile--paper span-wide countdown">
                    {next ? (
                      <>
                        <span className="countdown-label">
                          {next.day === 1 ? 'The first door opens in' : `Day ${next.day} opens in`}
                        </span>
                        <span className="countdown-value">{formatCountdown(next.at - now)}</span>
                      </>
                    ) : (
                      <>
                        <span className="countdown-label">All {TOTAL_DAYS} doors are open</span>
                        <span className="countdown-value">Merry Christmas!</span>
                      </>
                    )}
                  </div>
                );

              case 'badges':
                return (
                  <button
                    key="badges"
                    className="tile tile--ink tile--action"
                    onClick={() => onNavigate('badges')}
                  >
                    <span className="action-label">My badges</span>
                    <span className="action-value">0/{TOTAL_DAYS}</span>
                  </button>
                );

              case 'howto':
                return (
                  <button
                    key="howto"
                    className="tile tile--ink tile--action span-howto"
                    onClick={() => onNavigate('about')}
                  >
                    <span className="action-label">How it works</span>
                  </button>
                );

              case 'day': {
                const unlocked = isUnlocked(item.day, now);
                const today = isToday(item.day, now);
                const classes = [
                  'tile',
                  'tile--day',
                  `tile--${item.color}`,
                  unlocked ? 'is-open' : 'is-locked',
                  today && 'is-today',
                  shakingDay === item.day && 'is-shaking',
                ]
                  .filter(Boolean)
                  .join(' ');

                return (
                  <button
                    key={item.day}
                    className={classes}
                    aria-label={`December ${item.day}${unlocked ? (today ? ', today' : '') : ', locked'}`}
                    onClick={() =>
                      unlocked ? setOpenDay({ day: item.day, color: item.color }) : handleLocked(item.day)
                    }
                  >
                    <span className="day-number">{item.day}</span>
                    {!unlocked && <LockIcon className="day-lock" />}
                    {today && <span className="today-tag">Today</span>}
                  </button>
                );
              }
            }
          })}
        </div>
      </div>

      <div className={toast ? 'toast toast--show' : 'toast'} role="status" aria-live="polite">
        {toast}
      </div>

      {openDay && <DayModal day={openDay.day} color={openDay.color} onClose={closeModal} />}
    </>
  );
}
