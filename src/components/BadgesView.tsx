import { TOTAL_DAYS } from '../lib/time';
import { dayColorStyle } from '../data/layout';
import { useProgress } from '../lib/progress';
import CalendarSwitcher from './CalendarSwitcher';
import { FinaleBanner } from './Finale';
import { badgeIcon } from '../lib/badgeIcons';
import { WrappedBanner } from './Wrapped';
import { MemoriesBanner } from './Memories';
import { useCalendars } from '../lib/calendars';

export default function BadgesView() {
  const { byDay, solvedCount } = useProgress();
  const { current, calendars } = useCalendars();
  const days = Array.from({ length: TOTAL_DAYS }, (_, i) => i + 1);

  return (
    <section className="page">
      <h1 className="page-title">My badges</h1>
      <CalendarSwitcher />
      <FinaleBanner />
      <WrappedBanner />
      <MemoriesBanner />
      <p className="page-lead">
        {solvedCount} of {TOTAL_DAYS} badges collected{calendars.length > 1 ? ` in ${current.is_main ? current.title : current.is_owner ? 'your calendar' : `${current.owner_name ?? 'a friend'}’s calendar`}` : ''}. Collect them all:
        something special happens at the end ✨
      </p>
      <ul className="badges">
        {days.map((day) => {
          const p = byDay[day];
          const earned = Boolean(p?.solved_at);
          const grey = Boolean(p?.gave_up);
          return (
            <li
              key={day}
              className={`badge ${earned ? (grey ? 'badge--grey' : 'day-color') : 'badge--empty'}`}
              style={earned && !grey ? dayColorStyle(day) : undefined}
              aria-label={`Day ${day}${earned ? (grey ? ', answer revealed' : ', earned') : ''}`}
            >
              <span className={earned ? 'badge-icon' : 'badge-icon is-locked'} aria-hidden>
                {badgeIcon(day)}
              </span>
              <span className="badge-day">{day}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
