import type { ReactNode } from 'react';
import type { Interior } from './scene';

/**
 * A tiny room, drawn in a 100×130 box (scaled into the window).
 * Numbered rooms show the day on a frame, stocking or wall calendar.
 */
export function RoomItem({ kind, day, x = 0 }: { kind: Interior; day: number | null; x?: number }) {
  const g = (children: ReactNode) => <g transform={`translate(${x} 0)`}>{children}</g>;
  switch (kind) {
    case 'tree':
      return g(
        <>
          <path d="M50 30 L72 70 H60 L78 104 H22 L40 70 H28 Z" fill="#1F6B43" />
          <rect x="46" y="104" width="8" height="10" fill="#6B4423" />
          <circle className="room-twinkle" cx="44" cy="66" r="3" fill="#FFE27A" />
          <circle className="room-twinkle" cx="58" cy="84" r="3" fill="#FF6B5E" style={{ animationDelay: '-0.6s' }} />
          <circle className="room-twinkle" cx="38" cy="94" r="3" fill="#7FD3FF" style={{ animationDelay: '-1.1s' }} />
          <path d="M50 22 l3 6 6 1 -4.5 4 1 6 -5.5 -3 -5.5 3 1 -6 -4.5 -4 6 -1 Z" fill="#FFD34D" />
        </>,
      );
    case 'fireplace':
      return g(
        <>
          <rect x="18" y="64" width="64" height="52" fill="#8A4B32" />
          <rect x="14" y="58" width="72" height="8" fill="#5A2F1F" />
          <rect x="30" y="80" width="40" height="36" fill="#2A140C" />
          <path className="room-fire" d="M38 116 C 36 104, 46 100, 44 90 C 52 96, 50 104, 56 98 C 62 106, 62 112, 60 116 Z" fill="#FF9A3C" />
          <path className="room-fire room-fire--2" d="M44 116 C 44 108, 50 106, 50 100 C 56 106, 58 110, 56 116 Z" fill="#FFE07A" />
        </>,
      );
    case 'cat':
      return g(
        <path
          d="M34 118 C 30 100, 34 84, 42 78 L 38 64 L 48 72 L 56 72 L 64 62 L 62 78 C 70 86, 70 104, 66 118 Z M66 114 C 78 112, 84 100, 78 90"
          fill="#2B2230"
          stroke="#2B2230"
          strokeWidth="4"
          strokeLinecap="round"
        />,
      );
    case 'candles':
      return g(
        <>
          {[30, 50, 70].map((cx, i) => (
            <g key={cx}>
              <rect x={cx - 5} y={86 - i * 6} width="10" height={30 + i * 6} fill="#FFF4DC" />
              <path className="room-flame" d={`M${cx} ${72 - i * 6} c 4 6, 4 10, 0 12 c -4 -2, -4 -6, 0 -12 Z`} fill="#FFC94D" style={{ animationDelay: `${-i * 0.3}s` }} />
            </g>
          ))}
          <rect x="18" y="116" width="64" height="4" fill="#7A4A2A" />
        </>,
      );
    case 'gifts':
      return g(
        <>
          <rect x="20" y="88" width="34" height="28" fill="#D83A34" />
          <rect x="34" y="88" width="6" height="28" fill="#FFD34D" />
          <rect x="50" y="76" width="30" height="40" fill="#2E7D4F" />
          <rect x="62" y="76" width="6" height="40" fill="#F3E6D2" />
          <path d="M65 76 c -8 -10, -14 -2, 0 0 c 8 -10, 14 -2, 0 0" stroke="#F3E6D2" strokeWidth="3" fill="none" />
        </>,
      );
    case 'lamp':
      return g(
        <>
          <path d="M28 46 H52 L58 66 H22 Z" fill="#E7B65A" />
          <rect x="38" y="66" width="4" height="48" fill="#5A3A22" />
          <path d="M54 92 h28 a6 6 0 0 1 6 6 v18 h-40 v-18 a6 6 0 0 1 6 -6 Z" fill="#8E2F3A" />
        </>,
      );
    case 'books':
      return g(
        <>
          <rect x="18" y="56" width="64" height="4" fill="#6B4423" />
          <rect x="18" y="94" width="64" height="4" fill="#6B4423" />
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x={22 + i * 11} y={70 - (i % 2) * 6 + 0} width="9" height={24 + (i % 2) * 6} fill={['#A8322D', '#2F5E3F', '#22355A', '#C28A2C', '#5B2E4A'][i]} />
          ))}
        </>,
      );
    case 'frame':
      return g(
        <>
          <rect x="24" y="30" width="52" height="52" fill="#7A4A2A" />
          <rect x="30" y="36" width="40" height="40" fill="#FFF7E6" />
          <text x="50" y="66" textAnchor="middle" className="room-num">{day}</text>
        </>,
      );
    case 'stocking':
      return g(
        <>
          <rect x="14" y="40" width="72" height="5" fill="#6B4423" />
          <path d="M38 45 h26 v40 c0 12, -8 18, -22 18 h-6 c-8 0, -10 -10, -2 -12 l4 -2 Z" fill="#C8302B" />
          <rect x="36" y="45" width="30" height="16" fill="#FFF7E6" />
          <text x="51" y="58" textAnchor="middle" className="room-num room-num--small">{day}</text>
        </>,
      );
    case 'calendar':
      return g(
        <>
          <rect x="28" y="28" width="44" height="54" rx="3" fill="#FFF7E6" />
          <rect x="28" y="28" width="44" height="14" rx="3" fill="#C8302B" />
          <text x="50" y="38.5" textAnchor="middle" className="room-cal-month">DEC</text>
          <text x="50" y="72" textAnchor="middle" className="room-num">{day}</text>
        </>,
      );
  }
}
