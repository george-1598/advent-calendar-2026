import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { isUnlocked, TOTAL_DAYS } from '../../lib/time';
import { ariaStatus, type CalendarController } from '../calendar/controller';
import { LockIcon, StarIcon } from '../icons';
import Dome from './carousel/Dome';

/** 13 columns × 2 rows = 25 drawers + the logo panel. [top, bottom] per column. */
const COLUMNS: ReadonlyArray<readonly [number | 'logo', number]> = [
  ['logo', 2], [8, 5], [15, 18], [11, 20], [3, 14], [25, 10], [19, 7],
  [13, 23], [4, 16], [21, 12], [17, 22], [1, 9], [6, 24],
];
const N = COLUMNS.length;
const STEP = 360 / N;
const RED = '#B3172C';
const GREEN = '#0F4D33';
const PULL_MS = 450;
const TURN_MS = 600;

/** Normalise an angle to (-180, 180]. */
const norm = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;
const snap = (a: number) => Math.round(a / STEP) * STEP;
const columnOf = (day: number) => COLUMNS.findIndex((col) => col.includes(day));
const drawerColor = (col: number, row: number) => ((col + row) % 2 === 0 ? RED : GREEN);

export default function CarouselCalendar({ ctrl }: { ctrl: CalendarController }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const focusDay = (() => {
    // The most recent unlocked day (today during advent), else day 1.
    for (let d = TOTAL_DAYS; d >= 1; d--) if (isUnlocked(d, ctrl.now)) return d;
    return 1;
  })();

  const [angle, setAngle] = useState(() => -columnOf(focusDay) * STEP);
  const angleRef = useRef(angle);
  angleRef.current = angle;
  const [dragging, setDragging] = useState(false);
  const [pulled, setPulled] = useState<number | null>(null);
  const modalWasOpened = useRef(false);
  const suppressClick = useRef(false);
  const timers = useRef<number[]>([]);
  const drag = useRef<{
    x: number;
    start: number;
    lastX: number;
    lastT: number;
    velocity: number;
    moved: boolean;
    degPerPx: number;
  } | null>(null);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));

  useEffect(() => {
    if (ctrl.openDay === null && modalWasOpened.current) {
      modalWasOpened.current = false;
      setPulled(null);
    }
  }, [ctrl.openDay]);

  const turnToColumn = (col: number) => {
    const delta = norm(-col * STEP - angleRef.current);
    setAngle(angleRef.current + delta);
  };
  const turnBy = (columns: number) => setAngle(snap(angleRef.current) - columns * STEP);

  const onDrawer = (day: number) => {
    if (suppressClick.current || pulled !== null) return;
    const col = columnOf(day);
    const row = COLUMNS[col].indexOf(day);
    const act = () => {
      const s = ctrl.stateOf(day);
      if (!s.canOpen) return ctrl.rejectLocked(day);
      setPulled(day);
      later(() => {
        modalWasOpened.current = true;
        ctrl.open(day, drawerColor(col, row));
      }, PULL_MS);
    };
    if (Math.abs(norm(col * STEP + angleRef.current)) > STEP / 2) {
      turnToColumn(col);
      later(act, TURN_MS);
    } else {
      act();
    }
  };

  // ---- drag / swipe to turn ----
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const width = stageRef.current?.offsetWidth ?? 400;
    // Roughly match the drum surface to the finger: 360° per drum circumference.
    const radiusPx = width * 0.43;
    drag.current = {
      x: e.clientX,
      start: angleRef.current,
      lastX: e.clientX,
      lastT: performance.now(),
      velocity: 0,
      moved: false,
      degPerPx: 360 / (2 * Math.PI * radiusPx),
    };
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (!d.moved) {
      if (Math.abs(dx) < 6) return;
      d.moved = true;
      setDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    const t = performance.now();
    const v = (e.clientX - d.lastX) / Math.max(1, t - d.lastT);
    d.velocity = d.velocity * 0.6 + v * 0.4;
    d.lastX = e.clientX;
    d.lastT = t;
    setAngle(d.start + dx * d.degPerPx);
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d?.moved) return;
    // Fling: carry momentum for ~250ms worth of motion, then snap to a column.
    setAngle(snap(angleRef.current + d.velocity * 250 * d.degPerPx));
    setDragging(false);
    suppressClick.current = true;
    window.setTimeout(() => (suppressClick.current = false), 0);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') turnBy(-1);
    if (e.key === 'ArrowRight') turnBy(1);
  };

  return (
    <div className="carousel-wrap">
      <p className="theme-lead carousel-lead">Turn the carousel to find your drawer</p>
      <div
        ref={stageRef}
        className={dragging ? 'drum-stage is-dragging' : 'drum-stage'}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        tabIndex={0}
        aria-label="Advent carousel. Swipe or use the arrow keys to turn it."
      >
        <div className="drum-scene">
          <div className="drum-tilt">
            <div className="drum-rotor" style={{ transform: `rotateY(${angle}deg)` }}>
              <div className="drum-lid" />
              {COLUMNS.map((column, c) => {
                const rel = norm(c * STEP + angle);
                const facing = Math.cos((rel * Math.PI) / 180);
                const style = {
                  transform: `rotateY(${c * STEP}deg) translateZ(var(--R))`,
                  '--shade': (0.3 + 0.7 * Math.max(0, facing)).toFixed(3),
                  pointerEvents: Math.abs(rel) < 80 ? 'auto' : 'none',
                } as CSSProperties;
                return (
                  <div key={c} className="drum-col" style={style}>
                    <div className="drum-rim" />
                    {column.map((slot, row) =>
                      slot === 'logo' ? (
                        <div key="logo" className="drawer drawer--logo">
                          <span className="drawer-logo-script">Advent</span>
                          <span className="drawer-logo-year">2026</span>
                        </div>
                      ) : (
                        <Drawer
                          key={slot}
                          state={ctrl.stateOf(slot)}
                          color={drawerColor(c, row)}
                          pulled={pulled === slot}
                          shaking={ctrl.shakingDay === slot}
                          onClick={() => onDrawer(slot)}
                        />
                      ),
                    )}
                    <div className="drum-base" />
                  </div>
                );
              })}
            </div>
          </div>
          <Dome angle={angle} />
        </div>
      </div>

      <div className="drum-controls">
        <button className="drum-btn" aria-label="Turn left" onClick={() => turnBy(-1)}>
          ‹
        </button>
        <button className="drum-today" onClick={() => turnToColumn(columnOf(focusDay))}>
          {ctrl.stateOf(focusDay).today ? 'Today' : `Day ${focusDay}`}
        </button>
        <button className="drum-btn" aria-label="Turn right" onClick={() => turnBy(1)}>
          ›
        </button>
      </div>
      <p className="drum-hint">Swipe to turn · tap a drawer to open it</p>
    </div>
  );
}

interface DrawerProps {
  state: ReturnType<CalendarController['stateOf']>;
  color: string;
  pulled: boolean;
  shaking: boolean;
  onClick: () => void;
}

function Drawer({ state, color, pulled, shaking, onClick }: DrawerProps) {
  const classes = [
    'drawer',
    pulled && 'is-pulled',
    state.solved && 'is-solved',
    state.today && !state.solved && 'is-today',
    shaking && 'is-shaking',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      className={classes}
      style={{ '--drawer': color } as CSSProperties}
      onClick={onClick}
      aria-label={`December ${state.day}${ariaStatus(state)}`}
    >
      <span className="drawer-face">
        <span className="drawer-frame" />
        <span className="drawer-num">{state.day}</span>
        {state.solved && <StarIcon className="drawer-star" />}
        {!state.unlocked && <LockIcon className="drawer-lock" />}
      </span>
    </button>
  );
}
