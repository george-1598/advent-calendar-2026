import { useEffect, useState, type CSSProperties } from 'react';
import { PendingMark, PendingNote } from '../calendar/Pending';
import { useExplored } from '../../lib/explored';
import { playChime, playSweep } from '../../lib/sound';
import { TOTAL_DAYS, formatCountdown, unlockAt } from '../../lib/time';
import type { CalendarController } from '../calendar/controller';
import SoundToggle from '../SoundToggle';
import { KeyClue, useUnlocks } from '../../lib/unlocks';
import { StarIcon } from '../icons';
import ScratchCard, { CardFace } from './scratch/ScratchCard';
import { foilDataUrl } from './scratch/foil';
import { dailyDays } from '../../lib/daily';

// Cards are shuffled so you have to scratch to find today's number.
// Cards are rearranged daily.
const ORDER = dailyDays(1225, TOTAL_DAYS);
const FACE_COLORS = ['#B3172C', '#0F4D33', '#1F3A64'];

export default function ScratchCalendar({ ctrl }: { ctrl: CalendarController }) {
  const revealed = useExplored('scratch');
  const [active, setActive] = useState<number | null>(null);
  const [justRevealed, setJustRevealed] = useState(false);
  const { found } = useUnlocks();
  const [sweeping, setSweeping] = useState<Set<number> | null>(null);
  const hiddenDays = ORDER.filter((d) => !revealed.has(d));

  const scratchAll = () => {
    if (hiddenDays.length === 0) return;
    revealed.addMany(hiddenDays);
    setSweeping(new Set(hiddenDays));
    playSweep();
    window.setTimeout(playChime, 900);
    window.setTimeout(() => setSweeping(null), 600 + ORDER.length * 60 + 200);
  };
  const foil = foilDataUrl();

  useEffect(() => {
    if (active === null) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setActive(null);
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [active]);

  const openDay = (day: number) => {
    const s = ctrl.stateOf(day);
    if (!s.canOpen) return ctrl.rejectLocked(day);
    setActive(null);
    ctrl.open(day, FACE_COLORS[day % 3]);
  };

  const activeState = active ? ctrl.stateOf(active) : null;

  return (
    <div className="scratch-wrap">
      <div className="scratch-head">
        <p className="theme-lead scratch-lead">Scratch the foil to find today’s card</p>
        <SoundToggle />
      </div>
      <div className="scratch-grid" style={{ '--foil': `url(${foil})` } as CSSProperties}>
        {ORDER.map((day, i) => {
          const isRevealed = revealed.has(day);
          const solved = ctrl.stateOf(day).solved;
          return (
            <button
              key={day}
              className={isRevealed ? 'sc-tile is-revealed' : 'sc-tile'}
              style={{ '--fx': `${(i * 37) % 100}%`, '--fy': `${(i * 61) % 100}%` } as CSSProperties}
              aria-label={isRevealed ? `December ${day}` : 'A gold scratch card'}
              onClick={() => {
                if (isRevealed) openDay(day);
                else {
                  setJustRevealed(false);
                  setActive(day);
                }
              }}
            >
              {isRevealed ? <CardFace day={day} /> : <span className="sc-tile-foil" />}
              {sweeping?.has(day) && (
                <span className="sc-tile-foil is-peeling" style={{ animationDelay: `${i * 60}ms` }} />
              )}
              {solved && <StarIcon className="sc-tile-star" />}
              {isRevealed && <PendingMark state={ctrl.stateOf(day)} className="pending-mark--corner" />}
            </button>
          );
        })}
      </div>
      <KeyClue theme="scratch" className="key-clue--scratch" />
      <button className="theme-help" onClick={scratchAll} disabled={hiddenDays.length === 0}>
        Scratch all the cards at once
      </button>
      {revealed.size > 0 && (
        <button className="theme-reset" onClick={revealed.clear}>
          Cover all cards again
        </button>
      )}

      {active !== null && activeState && (
        <div className="sc-overlay" onClick={() => setActive(null)}>
          <div className="sc-overlay-inner" onClick={(e) => e.stopPropagation()}>
            <ScratchCard
              day={active}
              onRevealed={() => {
                revealed.add(active);
                found('scratch', active);
                setJustRevealed(true);
              }}
            />
            <div className="sc-actions">
              {!justRevealed ? (
                <p className="sc-hint">Scratch with your finger</p>
              ) : activeState.canOpen ? (
                <>
                  <PendingNote state={activeState} />
                  <button className="sc-btn sc-btn--primary" onClick={() => openDay(active)}>
                    Open December {active}
                  </button>
                </>
              ) : (
                <p className="sc-hint">Day {active} opens in {formatCountdown(unlockAt(active) - ctrl.now)}</p>
              )}
              <button className="sc-btn" onClick={() => setActive(null)}>
                Back to the cards
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
