import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useExplored } from '../../lib/explored';
import { playChime, playLightOff, playLightOn, soundEnabled, startWinterAmbience } from '../../lib/sound';
import type { CalendarController } from '../calendar/controller';
import { formatCountdown, unlockAt } from '../../lib/time';
import SoundToggle from '../SoundToggle';
import { useUnlocks } from '../../lib/unlocks';
import { RoomItem } from './village/Interior';
import { GROUND, HOUSES, SNOW, STARS, VIEW_H, VIEW_W, WINDOW_COUNT, type HouseSpec, type WindowSpec } from './village/scene';

const COSY = [
  'Just a cosy room. Keep looking ✨',
  'Someone’s warm and toasty in there — no number though.',
  'Lovely, but not this window.',
  'The cat says: try next door 🐈',
];

export default function VillageCalendar({ ctrl }: { ctrl: CalendarController }) {
  const lit = useExplored('village');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [peek, setPeek] = useState<WindowSpec | null>(null);
  const { found, clue } = useUnlocks();
  const [wave, setWave] = useState(false);
  const ambience = useRef<(() => void) | null>(null);

  // Winter wind + snowflakes, started on the first touch (browsers need a gesture).
  const startAmbience = () => {
    if (!ambience.current && soundEnabled()) ambience.current = startWinterAmbience();
  };
  const stopAmbience = () => {
    ambience.current?.();
    ambience.current = null;
  };
  useEffect(() => stopAmbience, []);

  const allIds = HOUSES.flatMap((h) => h.windows.map((w) => w.id));
  const allLit = allIds.every((id) => lit.has(id));

  const lightAll = () => {
    startAmbience();
    lit.addMany(allIds);
    setWave(true);
    for (let i = 0; i < 10; i++) window.setTimeout(playLightOn, i * 110);
    window.setTimeout(playChime, 1200);
    window.setTimeout(() => setWave(false), 2200);
  };

  const allOff = () => {
    playLightOff();
    lit.clear();
  };

  useEffect(() => {
    // Start in the middle of the street on narrow screens.
    const el = scrollRef.current;
    if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, []);

  const onWindow = (w: WindowSpec) => {
    startAmbience();
    if (!lit.has(w.id)) {
      lit.add(w.id);
      if (w.day) found('village', w.day);
      playLightOn();
      if (w.day) window.setTimeout(playChime, 250);
      return;
    }
    // Already lit: peek inside for a close-up of the room.
    setPeek(w);
  };

  const peekState = peek?.day ? ctrl.stateOf(peek.day) : null;

  return (
    <div className="village-wrap">
      <div className="village-head">
        <p className="theme-lead village-lead">Turn on the lights to find today’s window</p>
        <SoundToggle onChange={(on) => (on ? startAmbience() : stopAmbience())} />
      </div>
      <div className="village-scroll" ref={scrollRef} onPointerDown={startAmbience}>
        <svg className="village" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="group" aria-label="A snowy village at night">
          <defs>
            <linearGradient id="v-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#070F26" />
              <stop offset="0.55" stopColor="#14275A" />
              <stop offset="1" stopColor="#2C4479" />
            </linearGradient>
            <radialGradient id="v-moon-glow">
              <stop offset="0" stopColor="#FFF4C8" stopOpacity="0.55" />
              <stop offset="1" stopColor="#FFF4C8" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="v-window-glow">
              <stop offset="0" stopColor="#FFC85E" stopOpacity="0.75" />
              <stop offset="1" stopColor="#FFC85E" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="v-lamp-glow">
              <stop offset="0" stopColor="#FFE6A0" stopOpacity="0.7" />
              <stop offset="1" stopColor="#FFE6A0" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="v-glass" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#2B3760" />
              <stop offset="1" stopColor="#141B36" />
            </linearGradient>
            <linearGradient id="v-snow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#EAF1FB" />
              <stop offset="1" stopColor="#B9C9E4" />
            </linearGradient>
            <pattern id="v-planks" width="12" height="12" patternUnits="userSpaceOnUse">
              <rect width="12" height="12" fill="transparent" />
              <rect x="11" width="1" height="12" fill="#000" opacity="0.12" />
            </pattern>
            <pattern id="v-bricks" width="24" height="12" patternUnits="userSpaceOnUse">
              <path d="M0 11.5 H24 M12 0 V6 M0 5.5 H24 M0 6 V12 M24 6 V12" stroke="#000" strokeOpacity="0.18" strokeWidth="1" />
            </pattern>
            <filter id="v-blur" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" />
            </filter>
          </defs>

          {/* Sky */}
          <rect width={VIEW_W} height={VIEW_H} fill="url(#v-sky)" />
          {STARS.map((s, i) => (
            <circle
              key={i}
              className={s.twinkle ? 'v-star v-star--twinkle' : 'v-star'}
              cx={s.x}
              cy={s.y}
              r={s.r}
              style={{ animationDelay: `${-s.delay}s` }}
            />
          ))}
          <circle cx="990" cy="120" r="110" fill="url(#v-moon-glow)" />
          <circle cx="990" cy="120" r="44" fill="#FFF3C4" />
          <text x="990" y="128" textAnchor="middle" className="key-moon">
            {clue('village')}
          </text>
          <circle cx="1004" cy="110" r="9" fill="#F1E1A6" opacity="0.6" />
          <circle cx="978" cy="136" r="6" fill="#F1E1A6" opacity="0.5" />

          {/* Distant hills and houses */}
          <path d="M0 470 C 160 420, 300 460, 450 430 C 620 396, 760 450, 920 420 C 1040 400, 1120 430, 1200 410 V 640 H0 Z" fill="#1A2A55" />
          {[60, 180, 330, 520, 700, 880, 1080].map((x, i) => (
            <g key={x} opacity="0.85">
              <rect x={x} y={470 - (i % 3) * 14} width="70" height="180" fill="#16224A" />
              <path d={`M${x - 6} ${470 - (i % 3) * 14} L${x + 35} ${440 - (i % 3) * 14} L${x + 76} ${470 - (i % 3) * 14} Z`} fill="#DCE6F5" opacity="0.7" />
              <rect x={x + 14} y={496} width="10" height="13" fill="#FFCF6B" opacity={i % 2 ? 0.8 : 0.4} />
              <rect x={x + 44} y={520} width="10" height="13" fill="#FFCF6B" opacity={i % 2 ? 0.35 : 0.75} />
            </g>
          ))}

          {HOUSES.map((house, i) => (
            <House key={i} house={house} isLit={lit.has} onWindow={onWindow} wave={wave} />
          ))}

          {/* Ground */}
          <path d={`M0 ${GROUND - 6} C 300 ${GROUND + 4}, 600 ${GROUND - 10}, 1200 ${GROUND} V ${VIEW_H} H0 Z`} fill="url(#v-snow)" />
          <path d="M520 800 C 560 740, 640 700, 700 660 C 740 640, 800 640, 860 646" stroke="#C6D4EA" strokeWidth="40" fill="none" strokeLinecap="round" />

          {/* Lamp posts */}
          {[250, 820].map((x) => (
            <g key={x}>
              <circle cx={x} cy="512" r="70" fill="url(#v-lamp-glow)" />
              <rect x={x - 3} y="520" width="6" height="140" fill="#1E1B26" />
              <rect x={x - 10} y="656" width="20" height="8" fill="#1E1B26" />
              <path d={`M${x - 12} 520 h24 l-4 -22 h-16 Z`} fill="#FFE29A" stroke="#1E1B26" strokeWidth="3" />
              <path d={`M${x - 14} 498 h28 l-14 -10 Z`} fill="#1E1B26" />
            </g>
          ))}

          {/* Number plaques under the sills of numbered windows, drawn over the snow so none get buried */}
          {HOUSES.flatMap((h) => h.windows)
            .filter((w) => w.day !== null)
            .map((w) => (
              <g
                key={w.id}
                className={lit.has(w.id) ? 'v-plaque is-on' : 'v-plaque'}
                style={{ ['--delay' as string]: `${wave ? Math.round(w.x * 1.4 + (w.y % 97)) : 0}ms` }}
                aria-hidden="true"
              >
                <rect x={w.x + w.w / 2 - 15} y={w.y + w.h + 8} width="30" height="19" rx="4" fill="#8E1F1A" stroke="#E7C77E" strokeWidth="1.5" />
                <text x={w.x + w.w / 2} y={w.y + w.h + 22.5} textAnchor="middle" className="v-plaque-num">
                  {w.day}
                </text>
              </g>
            ))}

          {/* Christmas tree and snowman in the square */}
          <g transform="translate(140 776)">
            <path d="M0 -120 L36 -60 H20 L48 -10 H-48 L-20 -60 H-36 Z" fill="#174D33" />
            <path d="M-30 -64 Q 0 -50, 30 -64 M-40 -24 Q 0 -6, 40 -24" stroke="#F5D06B" strokeWidth="2" fill="none" />
            {[[-14, -70], [12, -56], [-24, -30], [6, -24], [26, -34], [-4, -96]].map(([x, y], i) => (
              <circle key={i} className="v-bulb" cx={x} cy={y} r="4" fill={['#FF6B5E', '#FFE27A', '#7FD3FF'][i % 3]} style={{ animationDelay: `${-i * 0.4}s` }} />
            ))}
            <rect x="-6" y="-10" width="12" height="16" fill="#5A3A22" />
            <path d="M0 -132 l4 8 9 1 -6.5 6 1.5 9 -8 -4.5 -8 4.5 1.5 -9 -6.5 -6 9 -1 Z" fill="#FFD34D" />
          </g>
          <g transform="translate(980 700)">
            <circle cx="0" cy="0" r="26" fill="#F4F7FC" />
            <circle cx="0" cy="-36" r="18" fill="#F4F7FC" />
            <rect x="-14" y="-62" width="28" height="8" fill="#1E1B26" />
            <rect x="-10" y="-80" width="20" height="20" fill="#1E1B26" />
            <path d="M0 -36 l12 3 -12 3 Z" fill="#F08A3C" />
            <path d="M-16 -22 Q 0 -14, 16 -22" stroke="#C8302B" strokeWidth="6" fill="none" />
          </g>

          {/* Falling snow */}
          <g className="v-snowfall" aria-hidden="true">
            {SNOW.map((s, i) => (
              <circle
                key={i}
                cx={s.x}
                cy={-10}
                r={s.r}
                fill="#FFFFFF"
                opacity="0.85"
                style={{ animationDuration: `${s.dur}s`, animationDelay: `${s.delay}s`, ['--drift' as string]: `${s.drift}px` }}
              />
            ))}
          </g>
        </svg>
      </div>
      {peek && (
        <div className="v-peek" onClick={() => setPeek(null)}>
          <div className="v-peek-card" onClick={(e) => e.stopPropagation()}>
            <svg className="v-peek-window" viewBox="-8 -8 116 150" aria-hidden="true">
              <rect x="0" y="0" width="100" height="130" fill={peek.wall} />
              <rect x="0" y="112" width="100" height="18" fill="#8A5A3A" opacity="0.6" />
              <RoomItem kind={peek.interior} day={peek.day} />
              <rect x="0" y="0" width="100" height="130" fill="none" stroke="#F3E6D2" strokeWidth="6" />
              <path d="M50 0 V130 M0 62 H100" stroke="#F3E6D2" strokeWidth="3" opacity="0.55" />
              <rect x="-8" y="128" width="116" height="10" fill="#F3E6D2" />
            </svg>
            {peek.day && peekState ? (
              <>
                <p className="v-peek-title">December {peek.day}</p>
                {peekState.canOpen ? (
                  <button
                    className="sc-btn sc-btn--primary"
                    onClick={() => {
                      const day = peek.day!;
                      setPeek(null);
                      ctrl.open(day, '#0A1430');
                    }}
                  >
                    {peekState.solved ? 'Open it again' : 'Open today’s quest'}
                  </button>
                ) : (
                  <p className="v-peek-note">This window’s surprise opens in {formatCountdown(unlockAt(peek.day) - ctrl.now)}</p>
                )}
              </>
            ) : (
              <p className="v-peek-note">{COSY[peek.id % COSY.length]}</p>
            )}
            <button
              className="sc-btn"
              onClick={() => {
                lit.remove(peek.id);
                playLightOff();
                setPeek(null);
              }}
            >
              Switch the light off
            </button>
            <button className="theme-reset" onClick={() => setPeek(null)}>
              Back to the street
            </button>
          </div>
        </div>
      )}
      <div className="village-foot">
        <span>
          {lit.size} / {WINDOW_COUNT} lights on · tap a lit window to peek inside
        </span>
        {lit.size > 0 && (
          <button className="theme-reset" onClick={allOff}>
            Turn all lights off
          </button>
        )}
      </div>
      <button className="theme-help" onClick={lightAll} disabled={allLit}>
        Light up every window
      </button>
    </div>
  );
}

function House({
  house,
  isLit,
  onWindow,
  wave,
}: {
  house: HouseSpec;
  isLit: (id: number) => boolean;
  onWindow: (w: WindowSpec) => void;
  wave: boolean;
}) {
  const top = GROUND - house.h;
  const { x, w } = house;
  const peakX = x + w / 2;
  const peakY = top - house.roofPeak;
  const eave = 14;
  const roof = `M${x - eave} ${top} L${peakX} ${peakY} L${x + w + eave} ${top} Z`;
  const chimneyX = house.chimney !== null ? x + w * house.chimney : 0;
  const chimneyBase = house.chimney !== null ? top - house.roofPeak * (1 - Math.abs(house.chimney - 0.5) * 2) + 14 : 0;

  return (
    <g>
      {house.chimney !== null && (
        <g>
          <rect x={chimneyX - 12} y={chimneyBase - 56} width="24" height="60" fill="#6E3B2C" />
          <rect x={chimneyX - 15} y={chimneyBase - 60} width="30" height="8" fill="#EAF1FB" />
          {[0, 1, 2].map((i) => (
            <circle key={i} className="v-smoke" cx={chimneyX} cy={chimneyBase - 66} r={8 + i * 3} style={{ animationDelay: `${-i * 1.3}s` }} />
          ))}
        </g>
      )}
      <rect x={x} y={top} width={w} height={house.h} fill={house.body} />
      {house.material !== 'plaster' && (
        <rect x={x} y={top} width={w} height={house.h} fill={house.material === 'bricks' ? 'url(#v-bricks)' : 'url(#v-planks)'} />
      )}
      <rect x={x} y={top} width="4" height={house.h} fill="#000" opacity="0.15" />
      <path d={roof} fill="#3B2C3A" />
      {/* Snow on the roof, with icicles */}
      <path
        d={`M${x - eave - 4} ${top + 4} L${peakX} ${peakY - 6} L${x + w + eave + 4} ${top + 4} L${x + w + eave - 8} ${top + 12} Q ${peakX + w * 0.2} ${top - 10}, ${peakX} ${peakY + 16} Q ${peakX - w * 0.2} ${top - 10}, ${x - eave + 8} ${top + 12} Z`}
        fill="#EEF4FC"
      />
      {Array.from({ length: Math.floor(w / 18) }, (_, i) => (
        <path key={i} d={`M${x + 6 + i * 18} ${top + 2} l3 ${8 + (i % 3) * 4} l3 ${-(8 + (i % 3) * 4)}`} fill="#DCE8F6" />
      ))}
      {/* Garland */}
      <path d={`M${x} ${house.garlandY} Q ${x + w / 4} ${house.garlandY + 16}, ${x + w / 2} ${house.garlandY} Q ${x + (3 * w) / 4} ${house.garlandY + 16}, ${x + w} ${house.garlandY}`} stroke="#1F5A3A" strokeWidth="5" fill="none" />
      {Array.from({ length: 8 }, (_, i) => {
        const t = (i + 0.5) / 8;
        const local = (t * 2) % 1;
        return (
          <circle
            key={i}
            className="v-bulb"
            cx={x + t * w}
            cy={house.garlandY + 4 * local * (1 - local) * 16 * 0.5 + 3}
            r="3"
            fill={['#FF6B5E', '#FFE27A', '#7FD3FF', '#9CF09C'][i % 4]}
            style={{ animationDelay: `${-i * 0.35}s` }}
          />
        );
      })}
      {house.door && (
        <g>
          <rect x={house.door.x} y={house.door.y} width={house.door.w} height={house.door.h} rx={house.door.w / 2} ry="10" fill={house.door.color} />
          <circle cx={house.door.x + house.door.w / 2} cy={house.door.y + 22} r="10" fill="none" stroke="#2E7D4F" strokeWidth="5" />
          <circle cx={house.door.x + house.door.w / 2} cy={house.door.y + 31} r="2.5" fill="#C8302B" />
          <circle cx={house.door.x + house.door.w * 0.8} cy={house.door.y + house.door.h * 0.6} r="2" fill="#E8C77A" />
        </g>
      )}
      {house.windows.map((win) => (
        <VillageWindow
          key={win.id}
          win={win}
          trim={house.trim}
          on={isLit(win.id)}
          // Light-all sweeps along the street from left to right.
          delay={wave ? Math.round(win.x * 1.4 + (win.y % 97)) : 0}
          onClick={() => onWindow(win)}
        />
      ))}
    </g>
  );
}

function VillageWindow({
  win,
  trim,
  on,
  delay,
  onClick,
}: {
  win: WindowSpec;
  trim: string;
  on: boolean;
  delay: number;
  onClick: () => void;
}) {
  const { x, y, w, h } = win;
  const clip = `v-win-${win.id}`;
  const shape = win.arched
    ? `M${x} ${y + h} V${y + w / 2} A${w / 2} ${w / 2} 0 0 1 ${x + w} ${y + w / 2} V${y + h} Z`
    : `M${x} ${y} H${x + w} V${y + h} H${x} Z`;
  const numbered = win.day !== null;
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <g
      className={on ? 'v-window is-on' : 'v-window'}
      style={{ ['--delay' as string]: `${delay}ms` }}
      role="button"
      tabIndex={0}
      aria-label={on ? (numbered ? `Lit window showing ${win.day}` : 'Lit window') : 'Dark window'}
      onClick={onClick}
      onKeyDown={onKey}
    >
      <ellipse className="v-window-glow" cx={x + w / 2} cy={y + h / 2} rx={w * 1.3} ry={h * 1.1} fill="url(#v-window-glow)" filter="url(#v-blur)" />
      <clipPath id={clip}>
        <path d={shape} />
      </clipPath>
      <path d={shape} fill="url(#v-glass)" />
      <g clipPath={`url(#${clip})`}>
        <g className="v-room">
          <rect x={x} y={y} width={w} height={h} fill={win.wall} />
          <rect x={x} y={y + h * 0.86} width={w} height={h * 0.14} fill="#8A5A3A" opacity="0.6" />
          <g transform={`translate(${x} ${y}) scale(${w / 100} ${h / 130})`}>
            {numbered ? (
              <RoomItem kind={win.interior} day={win.day} />
            ) : (
              <RoomItem kind={win.interior} day={null} />
            )}
          </g>
        </g>
        <path className="v-reflection" d={`M${x + w * 0.15} ${y + h} L${x + w * 0.85} ${y}`} stroke="#FFFFFF" strokeOpacity="0.08" strokeWidth={w * 0.25} />
      </g>
      {/* Frame and muntins */}
      <path d={shape} fill="none" stroke={trim} strokeWidth="4" />
      <path d={`M${x + w / 2} ${y + (win.arched ? 2 : 0)} V${y + h} M${x} ${y + h * 0.48} H${x + w}`} stroke={trim} strokeWidth="2.5" />
      <rect x={x - 5} y={y + h - 1} width={w + 10} height="6" fill={trim} />
      <path d={`M${x - 6} ${y + h - 1} Q ${x + w / 2} ${y + h - 9}, ${x + w + 6} ${y + h - 1} Z`} fill="#F4F8FD" />
      {/* Hit area */}
      <rect x={x - 4} y={y - 4} width={w + 8} height={h + 10} fill="transparent" />
    </g>
  );
}
