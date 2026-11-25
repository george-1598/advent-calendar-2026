/**
 * Glass dome with a little animated winter town: twinkling tree, skaters
 * circling the rink, falling snow and a sleigh crossing the sky. The town
 * shifts slightly as the drum turns, for a bit of parallax.
 */
const SNOW = Array.from({ length: 16 }, (_, i) => ({
  x: 20 + ((i * 47) % 160),
  r: 0.9 + ((i * 7) % 5) * 0.25,
  dur: 6 + ((i * 13) % 6),
  delay: -((i * 1.7) % 9),
}));

const BUILDINGS = [
  { x: 28, w: 18, h: 52 },
  { x: 44, w: 14, h: 72 },
  { x: 56, w: 20, h: 60 },
  { x: 120, w: 16, h: 80 },
  { x: 134, w: 22, h: 58 },
  { x: 154, w: 16, h: 66 },
  { x: 76, w: 12, h: 44 },
];

const LIGHTS = [
  [100, 78, '#F6D06B'],
  [92, 92, '#FF6B5E'],
  [108, 96, '#FFFFFF'],
  [88, 108, '#F6D06B'],
  [112, 112, '#FF6B5E'],
  [97, 120, '#FFFFFF'],
  [84, 124, '#FF6B5E'],
  [116, 126, '#F6D06B'],
] as const;

export default function Dome({ angle, clue }: { angle: number; clue: string | null }) {
  const shift = Math.sin((angle * Math.PI) / 180) * 7;

  return (
    <svg className="dome" viewBox="0 0 200 170" aria-hidden="true">
      <defs>
        <clipPath id="dome-clip">
          <path d="M8 150 A92 140 0 0 1 192 150 A92 16 0 0 1 8 150 Z" />
        </clipPath>
        <radialGradient id="dome-glass" cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.35" />
          <stop offset="0.6" stopColor="#DDEBF3" stopOpacity="0.12" />
          <stop offset="1" stopColor="#BFD6E4" stopOpacity="0.3" />
        </radialGradient>
        <linearGradient id="dome-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F3F0F6" stopOpacity="0.5" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.2" />
        </linearGradient>
      </defs>

      <ellipse cx="100" cy="151" rx="95" ry="17" fill="#5E0A17" />

      <g clipPath="url(#dome-clip)">
        <rect x="0" y="0" width="200" height="170" fill="url(#dome-sky)" />

        <g className="dome-sleigh">
          <path d="M0 0 h14 q4 0 5 -4 M2 0 q-3 -6 4 -7 h8" stroke="#E2B65A" strokeWidth="1.6" fill="none" />
          <path d="M22 -6 l6 -1 l3 -5 M30 -7 l7 -1 l3 -5 M39 -8 l7 -1" stroke="#E2B65A" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        </g>

        <g style={{ transform: `translateX(${shift}px)` }}>
          {BUILDINGS.map((b, i) => (
            <g key={i}>
              <rect x={b.x} y={140 - b.h} width={b.w} height={b.h} fill={i % 2 ? '#9E1027' : '#B5182F'} />
              {Array.from({ length: Math.floor(b.h / 12) }, (_, row) => (
                <rect key={row} x={b.x + 4} y={140 - b.h + 6 + row * 12} width={b.w - 8} height="3" fill="#F3C9A0" opacity="0.55" />
              ))}
            </g>
          ))}
          {/* the key, painted on the tallest building */}
          {clue !== null && (
            <text x="128" y="74" textAnchor="middle" className="key-building">
              {clue}
            </text>
          )}
        </g>

        <ellipse cx="100" cy="146" rx="96" ry="14" fill="#F8FBFC" />
        <ellipse cx="100" cy="144" rx="60" ry="8" fill="#DCEFF3" />

        <g style={{ transform: `translateX(${shift * -0.4}px)` }}>
          <path d="M40 140 q-9 -2 -7 -14 q2 -12 8 -14 q6 2 8 14 q2 12 -7 14 Z" fill="#2E7D4F" />
          <rect x="39" y="138" width="3" height="6" fill="#8A5A2B" />
          <path d="M162 140 q-8 -2 -6 -12 q2 -10 7 -12 q5 2 7 12 q2 10 -7 12 Z" fill="#E8C64E" />
          <g>
            <circle cx="146" cy="136" r="6" fill="#FFFFFF" />
            <circle cx="146" cy="126" r="4.2" fill="#FFFFFF" />
            <rect x="142.5" y="118" width="7" height="4" fill="#B5182F" />
            <path d="M146 126 l3 1 l-3 1 Z" fill="#F08A3C" />
          </g>
        </g>

        <g>
          <path d="M100 62 L80 98 H120 Z" fill="#0F5132" />
          <path d="M100 76 L74 118 H126 Z" fill="#11603B" />
          <path d="M100 92 L70 136 H130 Z" fill="#0F5132" />
          <rect x="97" y="134" width="6" height="7" fill="#6B4423" />
          {LIGHTS.map(([x, y, color], i) => (
            <circle key={i} className="dome-light" cx={x} cy={y} r="1.8" fill={color} style={{ animationDelay: `${i * -0.37}s` }} />
          ))}
          <path className="dome-star" d="M100 54 l2.2 4.6 5 .7 -3.6 3.5 .9 5 -4.5 -2.4 -4.5 2.4 .9 -5 -3.6 -3.5 5 -.7 Z" fill="#F2C14E" />
        </g>

        <g className="dome-skaters">
          <g className="dome-skater dome-skater--1">
            <circle cx="0" cy="-12" r="2.4" fill="#F1C7A5" />
            <path d="M-3.5 -9 h7 l1.5 7 h-10 Z" fill="#B5182F" />
            <path d="M-2 -2 l-2 5 M2 -2 l3 5" stroke="#3A2A2A" strokeWidth="1.2" />
          </g>
          <g className="dome-skater dome-skater--2">
            <circle cx="0" cy="-12" r="2.4" fill="#F1C7A5" />
            <path d="M-3.5 -9 h7 l1.5 7 h-10 Z" fill="#FFFFFF" />
            <path d="M-2 -2 l-3 5 M2 -2 l2 5" stroke="#3A2A2A" strokeWidth="1.2" />
          </g>
        </g>

        {SNOW.map((s, i) => (
          <circle
            key={i}
            className="dome-snow"
            cx={s.x}
            cy="0"
            r={s.r}
            fill="#FFFFFF"
            style={{ animationDuration: `${s.dur}s`, animationDelay: `${s.delay}s` }}
          />
        ))}
      </g>

      <path d="M8 150 A92 140 0 0 1 192 150" fill="url(#dome-glass)" stroke="#FFFFFF" strokeOpacity="0.55" strokeWidth="1.2" />
      <path d="M34 118 A70 110 0 0 1 72 36" fill="none" stroke="#FFFFFF" strokeOpacity="0.55" strokeWidth="4" strokeLinecap="round" />
      <path d="M160 70 A70 110 0 0 1 172 112" fill="none" stroke="#FFFFFF" strokeOpacity="0.3" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
