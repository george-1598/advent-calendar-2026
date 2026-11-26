import { useEffect, useState, type CSSProperties } from 'react';
import { playChime } from '../lib/sound';

const seenKey = (calendarId: string, day: number) => `advent-door-${calendarId}-${day}`;

/** Whether this day's door has been opened on this device before. */
export function doorSeen(calendarId: string, day: number): boolean {
  try {
    return localStorage.getItem(seenKey(calendarId, day)) === '1';
  } catch {
    return true;
  }
}

/** The first time a day is opened: two doors swing open over its number, with snow and a chime. Tap to skip. */
export default function DoorOpening({ calendarId, day, color, onDone }: { calendarId: string; day: number; color: string; onDone: () => void }) {
  const [phase, setPhase] = useState<'closed' | 'opening' | 'gone'>('closed');
  useEffect(() => {
    try {
      localStorage.setItem(seenKey(calendarId, day), '1');
    } catch {
      // ignore
    }
    const t1 = window.setTimeout(() => {
      setPhase('opening');
      playChime();
    }, 550);
    const t2 = window.setTimeout(() => setPhase('gone'), 1750);
    const t3 = window.setTimeout(onDone, 2100);
    return () => [t1, t2, t3].forEach(window.clearTimeout);
  }, [calendarId, day, onDone]);

  return (
    <div className={`door-open is-${phase}`} style={{ '--door': color } as CSSProperties} onClick={onDone} role="presentation" aria-hidden>
      <div className="door-snow">
        {Array.from({ length: 24 }, (_, i) => (
          <span key={i} style={{ left: `${(i * 41) % 100}%`, animationDelay: `${(i % 8) * 0.15}s`, animationDuration: `${1.6 + (i % 4) * 0.3}s` } as CSSProperties} />
        ))}
      </div>
      <div className="door-frame">
        <div className="door-leaf door-leaf--left">
          <span className="door-knob" />
        </div>
        <div className="door-leaf door-leaf--right">
          <span className="door-knob" />
        </div>
        <span className="door-num">{day}</span>
      </div>
    </div>
  );
}
