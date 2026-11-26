import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { PendingMark } from '../calendar/Pending';
import { useExplored } from '../../lib/explored';
import { playMusicNote, playRatchet } from '../../lib/sound';
import { TOTAL_DAYS } from '../../lib/time';
import type { CalendarController } from '../calendar/controller';
import SoundToggle from '../SoundToggle';
import LockAllButton from '../LockAllButton';
import { dailyDays } from '../../lib/daily';

// Jingle Bells (public domain), one octave up for that tinkly music-box sound: [midi, beats]
const E = 76, G = 79, C = 72, D = 74, F = 77;
const MELODY: [number, number][] = [
  [E, 1], [E, 1], [E, 2], [E, 1], [E, 1], [E, 2], [E, 1], [G, 1], [C, 1.5], [D, 0.5], [E, 4],
  [F, 1], [F, 1], [F, 1.5], [F, 0.5], [F, 1], [E, 1], [E, 1], [E, 0.5], [E, 0.5],
  [E, 1], [D, 1], [D, 1], [E, 1], [D, 2], [G, 2],
  [E, 1], [E, 1], [E, 2], [E, 1], [E, 1], [E, 2], [E, 1], [G, 1], [C, 1.5], [D, 0.5], [E, 4],
  [F, 1], [F, 1], [F, 1.5], [F, 0.5], [F, 1], [E, 1], [E, 1], [E, 0.5], [E, 0.5],
  [G, 1], [G, 1], [F, 1], [D, 1], [C, 4],
];
// Soft bass notes on the first beat of each bar.
const BASS = [48, 48, 53, 55, 48, 48, 55, 48];

/** Drawer grid on the front (5×5) and the order drawers pop open in. */
// Drawer plates and the pop-out order are rearranged daily.
const GRID = dailyDays(1225, TOTAL_DAYS);
const POP_ORDER = dailyDays(612, TOTAL_DAYS);

const DRAIN_PER_SEC = 3.2; // % of a full wind
const WIND_PER_TURN = 20; // % per full turn of the key

export default function MusicBoxCalendar({ ctrl }: { ctrl: CalendarController }) {
  const seen = useExplored('musicbox');
  const [energy, setEnergy] = useState(0);
  const energyRef = useRef(0);
  const [keyAngle, setKeyAngle] = useState(0);
  const [open, setOpen] = useState(false);
  const [popped, setPopped] = useState<Set<number>>(new Set());
  const [rattle, setRattle] = useState<number | null>(null);
  const keyRef = useRef<HTMLDivElement>(null);
  const wind = useRef<{ last: number; acc: number } | null>(null);
  const playing = useRef(false);
  const noteIndex = useRef(0);
  const beatCount = useRef(0);
  const popIndex = useRef(0);
  const closeTimer = useRef<number>();

  const setE = (v: number) => {
    energyRef.current = Math.max(0, Math.min(100, v));
    setEnergy(energyRef.current);
  };

  // Spring slowly unwinds.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (energyRef.current > 0 && playing.current) setE(energyRef.current - DRAIN_PER_SEC / 10);
    }, 100);
    return () => window.clearInterval(id);
  }, []);

  // Lid, music and drawers follow the spring.
  useEffect(() => {
    if (energy > 6 && !playing.current) {
      window.clearTimeout(closeTimer.current);
      playing.current = true;
      setOpen(true);
      window.setTimeout(playNext, 700);
    }
    if (energy <= 0 && playing.current) {
      playing.current = false;
      closeTimer.current = window.setTimeout(() => {
        setPopped(new Set());
        popIndex.current = 0;
        window.setTimeout(() => setOpen(false), 600);
      }, 1400);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [energy]);

  useEffect(
    () => () => {
      playing.current = false;
      window.clearTimeout(closeTimer.current);
    },
    [],
  );

  function playNext() {
    if (!playing.current) return;
    const [midi, beats] = MELODY[noteIndex.current % MELODY.length];
    playMusicNote(midi);
    // Tempo follows how wound-up the spring is: wind faster, play faster.
    const bpm = 84 + energyRef.current * 1.05;
    const beatMs = 60000 / bpm;
    const before = Math.floor(beatCount.current);
    beatCount.current += beats;
    if (Math.floor(beatCount.current / 4) !== Math.floor(before / 4)) {
      playMusicNote(BASS[Math.floor(beatCount.current / 4) % BASS.length], 0.05);
    }
    // A drawer pops open every two beats.
    if (Math.floor(beatCount.current / 2) !== Math.floor(before / 2) && popIndex.current < POP_ORDER.length) {
      const day = POP_ORDER[popIndex.current++];
      setPopped((p) => new Set(p).add(day));
      seen.add(day);
    }
    noteIndex.current++;
    window.setTimeout(playNext, beats * beatMs);
  }

  // ---- winding: drag around the key ----
  const angleAt = (e: PointerEvent) => {
    const r = keyRef.current!.getBoundingClientRect();
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
  };
  const onKeyDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    wind.current = { last: angleAt(e), acc: 0 };
  };
  const onKeyMove = (e: PointerEvent<HTMLDivElement>) => {
    const w = wind.current;
    if (!w) return;
    const a = angleAt(e);
    let d = a - w.last;
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    w.last = a;
    const deg = Math.abs((d * 180) / Math.PI);
    setKeyAngle((k) => k + deg);
    w.acc += deg;
    while (w.acc >= 30) {
      w.acc -= 30;
      playRatchet();
    }
    setE(energyRef.current + (deg / 360) * WIND_PER_TURN);
  };
  const onKeyUp = () => (wind.current = null);

  const windForMe = () => {
    for (let i = 0; i < 12; i++) window.setTimeout(playRatchet, i * 70);
    let turned = 0;
    const id = window.setInterval(() => {
      turned += 60;
      setKeyAngle((k) => k + 60);
      if (turned >= 720) window.clearInterval(id);
    }, 70);
    setE(100);
  };

  const onDrawer = (day: number) => {
    if (!popped.has(day)) {
      setRattle(day);
      window.setTimeout(() => setRattle(null), 450);
      ctrl.notify('Wind the key — the drawers only open while the music plays ♪');
      return;
    }
    const s = ctrl.stateOf(day);
    if (!s.canOpen) return ctrl.rejectLocked(day);
    ctrl.open(day, '#5A2A3A');
  };

  const today = (d: number) => {
    const s = ctrl.stateOf(d);
    return s.today && !s.solved;
  };

  return (
    <div className="mb-wrap">
      <div className="scratch-head">
        <p className="theme-lead mb-lead">Wind the key and watch the drawers</p>
        <SoundToggle />
      </div>
      <div className="mb-stage">
        <div className={open ? 'mb-box is-open' : 'mb-box'} style={{ '--spin': `${Math.max(0.6, 3.2 - energy / 40)}s` } as CSSProperties}>
          <div className="mb-face mb-back" />
          <div className="mb-face mb-left" />
          <div className="mb-face mb-right" />
          <div className="mb-face mb-floor">
            <span className="mb-mirror" />
          </div>
          <div className="mb-dancer" aria-hidden="true">
            <svg viewBox="0 0 40 80">
              <circle cx="20" cy="9" r="5" fill="#F1C7A5" />
              <path d="M17 5 q3 -5 6 0" fill="#5A3A22" />
              <path d="M20 14 L20 34" stroke="#F1C7A5" strokeWidth="3" />
              <path d="M20 18 L6 8 M20 18 L34 8" stroke="#F1C7A5" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M8 40 Q20 26 32 40 Q20 46 8 40 Z" fill="#F7A6C8" />
              <path d="M17 42 L15 70 M23 42 L22 58 L30 50" stroke="#F1C7A5" strokeWidth="2.4" strokeLinecap="round" fill="none" />
            </svg>
            <span className="mb-dancer-base" />
          </div>
          <div className="mb-lid">
            <div className="mb-lid-out">
              <span className="mb-inlay">✦</span>
            </div>
            <div className="mb-lid-in" />
          </div>
          <div className="mb-face mb-front">
            <div className="mb-drawers">
              {GRID.map((day) => (
                <button
                  key={day}
                  className={[
                    'mb-drawer',
                    popped.has(day) && 'is-out',
                    rattle === day && 'is-rattling',
                    today(day) && 'has-ribbon',
                    ctrl.stateOf(day).solved && 'is-solved',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-label={popped.has(day) || seen.has(day) ? `Drawer ${day}` : 'A little drawer'}
                  onClick={() => onDrawer(day)}
                >
                  <span className="mb-drawer-front">
                    <span className="mb-knob" />
                    {seen.has(day) && <span className="mb-plate">{day}</span>}
                    {seen.has(day) && <PendingMark state={ctrl.stateOf(day)} className="pending-mark--corner" />}
                  </span>
                  <span className="mb-card">{day}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div
          ref={keyRef}
          className="mb-key"
          role="slider"
          aria-label="Winding key — drag in circles to wind"
          aria-valuenow={Math.round(energy)}
          aria-valuemin={0}
          aria-valuemax={100}
          tabIndex={0}
          onPointerDown={onKeyDown}
          onPointerMove={onKeyMove}
          onPointerUp={onKeyUp}
          onPointerCancel={onKeyUp}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
              playRatchet();
              setKeyAngle((k) => k + 30);
              setE(energyRef.current + WIND_PER_TURN / 12);
            }
          }}
        >
          <span className="mb-key-shaft" />
          <span className="mb-key-bow" style={{ transform: `rotateX(${keyAngle}deg)` }} />
          <span className="mb-key-hint">↻</span>
        </div>
      </div>
      <div className="mb-gauge" aria-hidden="true">
        <span>Spring</span>
        <span className="mb-gauge-bar">
          <span style={{ width: `${energy}%` }} />
        </span>
      </div>
      <button className="theme-help" onClick={windForMe}>
        Wind it up for me
      </button>
      <p className="orn-hint">Drag in circles on the golden key · tap an open drawer</p>
      {/* The last theme in the chain: offer to start the theme hunt over. */}
      <LockAllButton />
    </div>
  );
}
