import { between, pick, rng } from '../../../lib/random';
import { TOTAL_DAYS } from '../../../lib/time';

export type Shape = 'ball' | 'drop' | 'bell' | 'star';
export type Pattern = 'stripes' | 'dots' | 'snow' | 'glitter' | 'plain';
export type Material = 'glass' | 'ceramic' | 'metal';

export interface OrnamentDesign {
  day: number;
  shape: Shape;
  pattern: Pattern;
  material: Material;
  color: string;
  dark: string;
  light: string;
  accent: string;
  /** Base radius before scaling. */
  size: number;
  mass: number;
  drag: number;
}

const COLORS = [
  { color: '#C8102E', dark: '#5E0614', light: '#FF8A8A' },
  { color: '#D4A017', dark: '#6E4E05', light: '#FFE9A0' },
  { color: '#AFBBC8', dark: '#4B5866', light: '#FFFFFF' },
  { color: '#1D4E9E', dark: '#0A1F4A', light: '#8FC0FF' },
  { color: '#1E7A46', dark: '#0A361D', light: '#8BE6B0' },
  { color: '#6B2C91', dark: '#2A0C40', light: '#D1A0FF' },
];
const ACCENTS = ['#FFFFFF', '#F6D36B', '#FFE3E3'];

const MATERIALS: Record<Material, { density: number; drag: number }> = {
  glass: { density: 0.6, drag: 2.4 },
  ceramic: { density: 1.1, drag: 1.7 },
  metal: { density: 1.7, drag: 1.1 },
};

export const DESIGNS: OrnamentDesign[] = (() => {
  const r = rng(2512);
  return Array.from({ length: TOTAL_DAYS }, (_, i) => {
    const c = pick(r, COLORS);
    const material = pick(r, ['glass', 'glass', 'ceramic', 'metal'] as Material[]);
    const shape = pick(r, ['ball', 'ball', 'ball', 'drop', 'bell', 'star'] as Shape[]);
    const size = between(r, 22, 30);
    const m = MATERIALS[material];
    return {
      day: i + 1,
      shape,
      pattern: pick(r, ['stripes', 'dots', 'snow', 'glitter', 'plain'] as Pattern[]),
      material,
      ...c,
      accent: pick(r, ACCENTS),
      size,
      mass: size * size * m.density,
      drag: m.drag,
    };
  });
})();

const SHAPES: Record<Shape, string> = {
  ball: 'M0 -48 A48 48 0 1 1 0 48 A48 48 0 1 1 0 -48 Z',
  drop: 'M0 -50 C 24 -22, 46 6, 40 26 C 32 50, -32 50, -40 26 C -46 6, -24 -22, 0 -50 Z',
  bell: 'M-8 -46 C -34 -40, -34 -6, -38 22 C -40 34, -48 38, -48 44 H48 C 48 38, 40 34, 38 22 C 34 -6, 34 -40, 8 -46 Z',
  star: 'M0 -50 L12 -16 L48 -15 L19 7 L30 42 L0 21 L-30 42 L-19 7 L-48 -15 L-12 -16 Z',
};

const glitter = Array.from({ length: 28 }, (_, i) => {
  const r = rng(i + 3);
  return { x: between(r, -40, 40), y: between(r, -40, 40), s: between(r, 0.8, 2.2) };
});

/**
 * A glass ornament. Its highlight and the little coloured reflections of the
 * tree lights shift with --hx/--hy (set from the tilt) to feel like real glass.
 */
export function OrnamentArt({ design, label }: { design: OrnamentDesign; label?: number | null }) {
  const id = `orn-${design.day}`;
  const d = SHAPES[design.shape];
  return (
    <svg className="orn-art" viewBox="-50 -50 100 100" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-g`} cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor={design.light} />
          <stop offset="0.45" stopColor={design.color} />
          <stop offset="1" stopColor={design.dark} />
        </radialGradient>
        <clipPath id={`${id}-c`}>
          <path d={d} />
        </clipPath>
      </defs>
      {/* hook and cap */}
      <path d="M0 -50 C -6 -60, 6 -66, 0 -72" stroke="#C9A24A" strokeWidth="2.4" fill="none" />
      <rect x="-9" y="-56" width="18" height="10" rx="2" fill="#D9B45A" />
      <rect x="-9" y="-56" width="18" height="3" fill="#F3DC95" />
      <path d={d} fill={`url(#${id}-g)`} />
      <g clipPath={`url(#${id}-c)`}>
        {design.pattern === 'stripes' && (
          <g fill={design.accent} opacity="0.85">
            <rect x="-60" y="-10" width="120" height="6" />
            <rect x="-60" y="6" width="120" height="3" />
            <rect x="-60" y="-22" width="120" height="3" />
          </g>
        )}
        {design.pattern === 'dots' && (
          <g fill={design.accent} opacity="0.85">
            {[-30, -10, 10, 30].flatMap((x, i) =>
              [-24, 0, 24].map((y) => <circle key={`${x}${y}`} cx={x + (i % 2) * 6} cy={y + (i % 2) * 8} r="4" />),
            )}
          </g>
        )}
        {design.pattern === 'snow' && (
          <g stroke={design.accent} strokeWidth="2.6" strokeLinecap="round" opacity="0.9">
            <path d="M0 -18 V18 M-15.6 -9 L15.6 9 M-15.6 9 L15.6 -9" />
            <path d="M-4 -14 L0 -18 L4 -14 M-4 14 L0 18 L4 14" fill="none" />
          </g>
        )}
        {design.pattern === 'glitter' && (
          <g fill={design.accent}>
            {glitter.map((g, i) => (
              <circle key={i} className="orn-glitter" cx={g.x} cy={g.y} r={g.s} style={{ animationDelay: `${-i * 0.13}s` }} />
            ))}
          </g>
        )}
        {/* reflections of the tree lights */}
        <g className="orn-reflect">
          <ellipse cx="-16" cy="-20" rx="13" ry="8" fill="#FFFFFF" opacity="0.65" transform="rotate(-35 -16 -20)" />
          <circle cx="-4" cy="-30" r="2.2" fill="#FFE27A" className="orn-twinkle" />
          <circle cx="-26" cy="-6" r="1.8" fill="#FF8A7A" className="orn-twinkle" style={{ animationDelay: '-0.7s' }} />
          <circle cx="8" cy="-24" r="1.5" fill="#8FD8FF" className="orn-twinkle" style={{ animationDelay: '-1.3s' }} />
        </g>
        <ellipse cx="18" cy="26" rx="20" ry="12" fill="#000" opacity="0.18" />
      </g>
      {label != null && (
        <text className="orn-label" x="0" y={design.shape === 'bell' ? 12 : 6} textAnchor="middle" dominantBaseline="middle">
          {label}
        </text>
      )}
    </svg>
  );
}
