import { useEffect, useState } from 'react';
import { useExplored } from '../../lib/explored';
import { playChime, playSnap } from '../../lib/sound';
import { formatCountdown, unlockAt } from '../../lib/time';
import type { CalendarController } from '../calendar/controller';
import SoundToggle from '../SoundToggle';
import { KeyClue, useUnlocks } from '../../lib/unlocks';
import Cracker, { Confetti } from './crackers/Cracker';
import { CRACKERS, CRACKER_ORDER } from './crackers/data';

function Crown({ color, gold }: { color: string; gold: boolean }) {
  return (
    <svg className={gold ? 'cr-crown is-gold' : 'cr-crown'} viewBox="0 0 120 60" aria-hidden="true">
      <path d="M4 56 L10 12 L32 34 L46 6 L60 30 L74 6 L88 34 L110 12 L116 56 Z" fill={gold ? '#F2C14E' : color} />
      <path d="M4 56 L116 56 L114 46 L6 46 Z" fill="#000" opacity="0.12" />
      {gold && [10, 46, 74, 110].map((x) => <circle key={x} cx={x} cy={x === 46 || x === 74 ? 7 : 13} r="4" fill="#FFF3C4" />)}
    </svg>
  );
}

export default function CrackersCalendar({ ctrl }: { ctrl: CalendarController }) {
  const pulled = useExplored('crackers');
  const [snapped, setSnapped] = useState<Set<number>>(new Set());
  const [reveal, setReveal] = useState<number | null>(null);
  const [punchline, setPunchline] = useState(false);
  const { found } = useUnlocks();

  useEffect(() => {
    if (reveal === null) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setReveal(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [reveal]);

  const snap = (day: number, showReveal = true) => {
    playSnap();
    setSnapped((s) => new Set(s).add(day));
    window.setTimeout(() => {
      pulled.add(day);
      setSnapped((s) => {
        const n = new Set(s);
        n.delete(day);
        return n;
      });
      if (showReveal) {
        setPunchline(false);
        setReveal(day);
        playChime();
      }
    }, 650);
  };

  const pullAll = () => {
    const left = CRACKER_ORDER.filter((d) => !pulled.has(d));
    left.forEach((d, i) => window.setTimeout(() => snap(d, false), i * 90));
  };

  const r = reveal !== null ? CRACKERS[reveal] : null;
  const rs = reveal !== null ? ctrl.stateOf(reveal) : null;

  return (
    <div className="crackers-wrap">
      <div className="scratch-head">
        <p className="theme-lead crackers-lead">Pull a cracker — bang! — to see its number</p>
        <SoundToggle />
      </div>
      <div className="crackers">
        {CRACKER_ORDER.map((day) => (
          <div key={day} className="cr-cell">
            <Cracker
              design={CRACKERS[day]}
              pulled={pulled.has(day) && !snapped.has(day)}
              bursting={snapped.has(day)}
              label={pulled.has(day) ? `Cracker ${day}, pulled` : 'A cracker — drag sideways to pull it'}
              onSnap={() => {
                snap(day);
                found('crackers', day);
              }}
              onTapPulled={() => {
                setPunchline(false);
                setReveal(day);
              }}
            />
          </div>
        ))}
      </div>
      <KeyClue theme="crackers" className="key-clue--crackers" />
      <button className="theme-help" onClick={pullAll} disabled={CRACKER_ORDER.every((d) => pulled.has(d))}>
        Pull them all at once
      </button>
      {pulled.size > 0 && (
        <button className="theme-reset" onClick={pulled.clear}>
          Put new crackers out
        </button>
      )}
      <p className="orn-hint">Grab a cracker and drag sideways (or pull with two fingers)</p>

      {r && rs && reveal !== null && (
        <div className="cr-reveal" onClick={() => setReveal(null)}>
          <div className="cr-card" onClick={(e) => e.stopPropagation()}>
            <Confetti count={36} />
            <Crown color={r.crown} gold={rs.today} />
            <p className="cr-q">{r.joke[0]}</p>
            {punchline ? (
              <p className="cr-a">{r.joke[1]}</p>
            ) : (
              <button className="cr-tell" onClick={() => setPunchline(true)}>
                Tap for the answer
              </button>
            )}
            <span className="cr-big">{reveal}</span>
            {rs.canOpen ? (
              <button
                className="sc-btn sc-btn--primary"
                onClick={() => {
                  setReveal(null);
                  ctrl.open(reveal, r.a);
                }}
              >
                {rs.solved ? 'Open it again' : `Open December ${reveal}`}
              </button>
            ) : (
              <p className="cr-note">Day {reveal} opens in {formatCountdown(unlockAt(reveal) - ctrl.now)}</p>
            )}
            <button className="theme-reset" onClick={() => setReveal(null)}>
              Back to the crackers
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
