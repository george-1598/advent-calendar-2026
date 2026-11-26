import { calendarLabel, useCalendars } from '../lib/calendars';
import { playClick } from '../lib/sound';

/** Chips to switch between the main calendar and friends' calendars (hidden when there's only one). */
export default function CalendarSwitcher() {
  const { calendars, currentId, select } = useCalendars();
  if (calendars.length < 2) return null;
  return (
    <div className="cal-switch" role="tablist" aria-label="Calendars">
      {calendars.map((c) => (
        <button
          key={c.id}
          role="tab"
          aria-selected={c.id === currentId}
          className="cal-switch-chip"
          onClick={() => {
            if (c.id === currentId) return;
            playClick();
            select(c.id);
          }}
        >
          <span>{calendarLabel(c)}</span>
          {!c.is_main && !c.is_owner && <small>{c.title}</small>}
          {c.is_owner && <small>Preview</small>}
        </button>
      ))}
    </div>
  );
}
