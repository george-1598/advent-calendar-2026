import { useCallback, useEffect, useState, type MouseEvent } from 'react';
import type { View } from '../App';
import { LAYOUT, dayColorStyle } from '../data/layout';
import { useNow } from '../lib/useNow';
import { TOTAL_DAYS, formatCountdown, isToday, isUnlocked, unlockAt } from '../lib/time';
import { useAuth } from '../lib/auth';
import { useProgress } from '../lib/progress';
import CountdownBanner from './CountdownBanner';
import DayModal from './DayModal';
import IntroSlider from './IntroSlider';
import { LockIcon, StarIcon } from './icons';

export default function Calendar({ onNavigate }: { onNavigate: (view: View) => void }) {
  const now = useNow();
  const { profile } = useAuth();
  const { byDay, solvedCount } = useProgress();
  const isAdmin = Boolean(profile?.is_admin);

  const [openDay, setOpenDay] = useState<{ day: number; color: string } | null>(null);
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

  // The tile's colour depends on the breakpoint, so read what's actually shown.
  const openTile = (day: number, e: MouseEvent<HTMLButtonElement>) => {
    setOpenDay({ day, color: getComputedStyle(e.currentTarget).backgroundColor });
  };

  const closeModal = useCallback(() => setOpenDay(null), []);

  const introMessages = [
    profile ? `Hi ${profile.display_name}! Merry Christmas` : 'A Christmas advent calendar made with love',
    '25 days · 25 quests · 25 surprises',
    'Swipe, solve, unlock a real gift',
  ];

  return (
    <>
      <CountdownBanner now={now} />

      <div className="grid-wrap">
        <div className="grid">
          {LAYOUT.map((item) => {
            switch (item.kind) {
              case 'intro':
                return (
                  <div key="intro" className="tile tile--ink span-intro">
                    <IntroSlider messages={introMessages} />
                  </div>
                );

              case 'logo':
                return (
                  <div key="logo" className="tile tile--paper span-logo logo">
                    <span className="logo-script">Advent</span>
                    <span className="logo-sub">Calendar 2026</span>
                  </div>
                );

              case 'badges':
                return (
                  <button
                    key="badges"
                    className="tile tile--ink tile--action"
                    onClick={() => onNavigate('badges')}
                  >
                    <span className="action-label">Badges</span>
                    <span className="action-value">
                      {solvedCount}/{TOTAL_DAYS}
                    </span>
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
                const solved = Boolean(byDay[item.day]?.solved_at);
                // Admins can open locked days to preview and test quests.
                const canOpen = unlocked || isAdmin;
                const classes = [
                  'tile',
                  'tile--day',
                  'day-color',
                  canOpen ? 'is-open' : 'is-locked',
                  !unlocked && 'is-future',
                  today && !solved && 'is-today',
                  solved && 'is-solved',
                  shakingDay === item.day && 'is-shaking',
                ]
                  .filter(Boolean)
                  .join(' ');

                const status = solved ? ', solved' : !unlocked ? ', locked' : today ? ', today' : '';

                return (
                  <button
                    key={item.day}
                    className={classes}
                    style={dayColorStyle(item.day)}
                    aria-label={`December ${item.day}${status}`}
                    onClick={(e) => (canOpen ? openTile(item.day, e) : handleLocked(item.day))}
                  >
                    <span className="day-number">{item.day}</span>
                    {!unlocked && <LockIcon className="day-lock" />}
                    {solved && <StarIcon className="day-star" />}
                    {today && !solved && <span className="today-tag">Today</span>}
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
