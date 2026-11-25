import type { MouseEvent } from 'react';
import type { View } from '../../App';
import { LAYOUT, dayColorStyle } from '../../data/layout';
import { TOTAL_DAYS } from '../../lib/time';
import { useAuth } from '../../lib/auth';
import { useProgress } from '../../lib/progress';
import { ariaStatus, type CalendarController } from '../calendar/controller';
import IntroSlider from '../IntroSlider';
import { LockIcon, StarIcon } from '../icons';

interface Props {
  ctrl: CalendarController;
  onNavigate: (view: View) => void;
}

export default function ClassicCalendar({ ctrl, onNavigate }: Props) {
  const { profile } = useAuth();
  const { solvedCount } = useProgress();

  // The tile's colour depends on the breakpoint, so read what's actually shown.
  const openTile = (day: number, e: MouseEvent<HTMLButtonElement>) =>
    ctrl.open(day, getComputedStyle(e.currentTarget).backgroundColor);

  const introMessages = [
    profile ? `Hi ${profile.display_name}! Merry Christmas` : 'A Christmas advent calendar made with love',
    '25 days · 25 quests · 25 surprises',
    'Swipe, solve, unlock a real gift',
  ];

  return (
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
                <button key="badges" className="tile tile--ink tile--action" onClick={() => onNavigate('badges')}>
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
              const s = ctrl.stateOf(item.day);
              const classes = [
                'tile',
                'tile--day',
                'day-color',
                s.canOpen ? 'is-open' : 'is-locked',
                !s.unlocked && 'is-future',
                s.today && !s.solved && 'is-today',
                s.solved && 'is-solved',
                ctrl.shakingDay === item.day && 'is-shaking',
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <button
                  key={item.day}
                  className={classes}
                  style={dayColorStyle(item.day)}
                  aria-label={`December ${item.day}${ariaStatus(s)}`}
                  onClick={(e) => (s.canOpen ? openTile(item.day, e) : ctrl.rejectLocked(item.day))}
                >
                  <span className="day-number">{item.day}</span>
                  {!s.unlocked && <LockIcon className="day-lock" />}
                  {s.solved && <StarIcon className="day-star" />}
                  {s.today && !s.solved && <span className="today-tag">Today</span>}
                </button>
              );
            }
          }
        })}
      </div>
    </div>
  );
}
