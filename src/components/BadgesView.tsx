import { TOTAL_DAYS } from '../lib/time';
import { dayColorStyle } from '../data/layout';
import { useProgress } from '../lib/progress';
import { StarIcon } from './icons';
import CalendarSwitcher from './CalendarSwitcher';
import { useCalendars } from '../lib/calendars';

export default function BadgesView() {
  const { byDay, solvedCount } = useProgress();
  const { current, calendars } = useCalendars();
  const days = Array.from({ length: TOTAL_DAYS }, (_, i) => i + 1);

  return (
    <section className="page">
      <h1 className="page-title">My badges</h1>
      <CalendarSwitcher />
      <p className="page-lead">
        {solvedCount} of {TOTAL_DAYS} collected{calendars.length > 1 ? ` in ${current.is_main ? current.title : current.is_owner ? 'your calendar' : `${current.owner_name ?? 'a friend'}’s calendar`}` : ''}. Solve a day’s quest to earn its badge.
      </p>
      <ul className="badges">
        {days.map((day) => {
          const p = byDay[day];
          const earned = Boolean(p?.solved_at);
          return (
            <li
              key={day}
              className={`badge ${earned ? 'day-color' : 'badge--empty'}`}
              style={earned ? dayColorStyle(day) : undefined}
              aria-label={`Day ${day}${earned ? ', earned' : ''}`}
            >
              {earned && p?.badge_letter ? (
                <span className="badge-letter">{p.badge_letter}</span>
              ) : (
                <StarIcon className="badge-star" />
              )}
              <span className="badge-day">{day}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
