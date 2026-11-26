import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useProgress } from '../lib/progress';
import { useCalendars } from '../lib/calendars';
import { TOTAL_DAYS } from '../lib/time';
import { playChime } from '../lib/sound';

interface FinaleInfo {
  unlocked: boolean;
  done: number;
  total: number;
  message: string | null;
  from: string | null;
}

/** Whether this calendar's finale is unlocked (re-checked as days get solved). */
export function useFinale(): FinaleInfo | null {
  const { currentId } = useCalendars();
  const { solvedCount } = useProgress();
  const [info, setInfo] = useState<FinaleInfo | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabase.rpc('get_finale', { p_calendar: currentId }).then(({ data, error }) => {
      if (!cancelled) setInfo(error ? null : (data as FinaleInfo | null));
    });
    return () => {
      cancelled = true;
    };
  }, [currentId, solvedCount]);
  return info;
}

/** The badge letters of solved days, in day order (given-up days are marked). */
export function useLetters(): { letter: string; day: number; gaveUp: boolean }[] {
  const { byDay } = useProgress();
  return Array.from({ length: TOTAL_DAYS }, (_, i) => byDay[i + 1])
    .filter((p) => p?.solved_at)
    .map((p) => ({ letter: p!.badge_letter || '★', day: p!.day, gaveUp: Boolean(p!.gave_up) }));
}

export function FinaleBanner() {
  const finale = useFinale();
  const [open, setOpen] = useState(false);
  if (!finale?.unlocked) return null;
  return (
    <>
      <button className="finale-banner" onClick={() => setOpen(true)}>
        <span>🎉</span>
        <span>
          <strong>You did it! Every door is open</strong>
          <small>Tap to reveal your finale</small>
        </span>
      </button>
      {open && <FinaleReveal finale={finale} onClose={() => setOpen(false)} />}
    </>
  );
}

function FinaleReveal({ finale, onClose }: { finale: FinaleInfo; onClose: () => void }) {
  const letters = useLetters();
  const [shown, setShown] = useState(0);
  const done = shown >= letters.length;
  useEffect(() => {
    if (done) {
      playChime();
      return;
    }
    const t = window.setTimeout(() => setShown((n) => n + 1), shown === 0 ? 500 : 260);
    return () => window.clearTimeout(t);
  }, [shown, done]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="finale" role="dialog" aria-modal="true" aria-label="Finale" onClick={onClose}>
      {done && <Confetti />}
      <div className="finale-card" onClick={(e) => e.stopPropagation()}>
        {letters.length > 0 && <span className="finale-kicker">Your letters</span>}
        <div className="finale-letters" aria-label={letters.map((l) => l.letter).join('')}>
          {letters.map((l, i) => (
            <span key={l.day} className={['finale-letter', i < shown && 'is-in', l.gaveUp && 'is-grey'].filter(Boolean).join(' ')} style={{ '--i': i } as CSSProperties}>
              {l.letter}
            </span>
          ))}
        </div>
        <div className={done ? 'finale-message is-in' : 'finale-message'}>
          {finale.message ? (
            <p>{finale.message}</p>
          ) : (
            <p>All {finale.total} doors opened. Merry Christmas! 🎄</p>
          )}
          {finale.from && <span className="finale-from">— {finale.from}</span>}
        </div>
        <button className="btn-primary finale-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>,
    document.body,
  );
}

const COLORS = ['#c8102e', '#1e7a46', '#f2c14e', '#1d4e9e', '#ffffff', '#ff7a59'];
export function Confetti() {
  const pieces = Array.from({ length: 70 }, (_, i) => i);
  return (
    <div className="confetti" aria-hidden>
      {pieces.map((i) => (
        <span
          key={i}
          style={
            {
              left: `${(i * 37) % 100}%`,
              background: COLORS[i % COLORS.length],
              animationDelay: `${(i % 14) * 0.12}s`,
              animationDuration: `${2.6 + (i % 5) * 0.4}s`,
              '--drift': `${((i * 53) % 120) - 60}px`,
              '--spin': `${(i * 97) % 720}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
