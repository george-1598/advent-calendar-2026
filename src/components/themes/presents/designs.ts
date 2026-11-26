import { TOTAL_DAYS } from '../../../lib/time';
import { dailyDays } from '../../../lib/daily';

/**
 * Procedurally generated (but deterministic) gift designs — the same day always
 * gets the same paper, twine, decoration and tag.
 */

export interface Paper {
  name: string;
  bg: string;
  edge: string;
  dot: string;
  patterns: Pattern[];
}

export type Pattern = 'dots' | 'snow' | 'plus' | 'plain';
export type Shape = 'wide' | 'tall' | 'square';
export type Deco = 'wreath' | 'cane' | 'sprig' | 'none';

export interface TwineLine {
  d: string;
  color: string;
}

export interface GiftDesign {
  paper: Paper;
  pattern: Pattern;
  shape: Shape;
  tilt: number;
  knotX: number;
  knotY: number;
  twine: TwineLine[];
  bowColor: string;
  deco: Deco;
  decoRotation: number;
  showBow: boolean;
  tag: { bg: string; ink: string; side: 'left' | 'right'; rotation: number };
  /** Animation phase offset (seconds) so gifts don't move in sync. */
  phase: number;
}

const PAPERS: Paper[] = [
  { name: 'mint', bg: '#BFE0DC', edge: '#97C9C3', dot: '#FFFFFF', patterns: ['dots', 'snow', 'plain'] },
  { name: 'pink', bg: '#F8CFC6', edge: '#EDB1A5', dot: '#FFFFFF', patterns: ['plain', 'plain', 'dots'] },
  { name: 'kraft', bg: '#C98D52', edge: '#AE7440', dot: '#FFFFFF', patterns: ['snow', 'dots'] },
  { name: 'navy', bg: '#3F5D8C', edge: '#2E4772', dot: '#FFFFFF', patterns: ['plain', 'plain', 'dots'] },
  { name: 'red', bg: '#EE4A33', edge: '#CC3420', dot: '#FFFFFF', patterns: ['dots', 'snow'] },
  { name: 'green', bg: '#46B57A', edge: '#33976A', dot: '#F7D9D1', patterns: ['plus'] },
];

const TWINE = {
  navy: '#34548A',
  red: '#E94B3C',
  pink: '#F4C3B9',
  white: '#EEF4F2',
};

// Which twine colours read well on each paper.
const TWINE_FOR: Record<string, string[]> = {
  mint: [TWINE.navy, TWINE.red],
  pink: [TWINE.navy, TWINE.red],
  kraft: [TWINE.navy, TWINE.red, TWINE.pink],
  navy: [TWINE.pink, TWINE.white, TWINE.red],
  red: [TWINE.white, TWINE.navy, TWINE.pink],
  green: [TWINE.navy, TWINE.red, TWINE.white],
};

function rng(seed: number) {
  // mulberry32
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(r: () => number, items: T[]): T => items[Math.floor(r() * items.length)];
const between = (r: () => number, min: number, max: number) => min + r() * (max - min);

function twineLines(r: () => number, kx: number, ky: number, dir: 'h' | 'v', colors: string[]): TwineLine[] {
  const count = 2 + Math.floor(r() * 3);
  return Array.from({ length: count }, (_, i) => {
    const offset = (i - (count - 1) / 2) * between(r, 1.6, 2.8);
    const j = () => between(r, -1.6, 1.6);
    const color = i === count - 1 && colors.length > 1 ? colors[1] : colors[0];
    if (dir === 'h') {
      const y = ky + offset;
      return { color, d: `M-3 ${y + j()} C 30 ${y + j()}, 66 ${y + j()}, 103 ${y + j()}` };
    }
    const x = kx + offset;
    return { color, d: `M${x + j()} -3 C ${x + j()} 30, ${x + j()} 66, ${x + j()} 103` };
  });
}

function makeDesign(day: number, paper: Paper): GiftDesign {
  const r = rng(day * 7919 + 17);
  const twineColors = [...TWINE_FOR[paper.name]].sort(() => r() - 0.5);
  const knotX = between(r, 40, 60);
  const knotY = between(r, 36, 56);
  const ribbon = pick(r, ['h', 'v', 'cross', 'cross'] as const);

  const twine = [
    ...(ribbon !== 'v' ? twineLines(r, knotX, knotY, 'h', twineColors) : []),
    ...(ribbon !== 'h' ? twineLines(r, knotX, knotY, 'v', twineColors) : []),
  ];

  const deco = pick(r, ['wreath', 'cane', 'sprig', 'none'] as Deco[]);
  const tagOnKraft = paper.name === 'kraft';
  const tag = tagOnKraft
    ? pick(r, [
        { bg: '#F8CFC6', ink: '#3F5D8C' },
        { bg: '#3F5D8C', ink: '#FFFFFF' },
      ])
    : pick(r, [
        { bg: '#C98D52', ink: '#FFFFFF' },
        { bg: '#C98D52', ink: '#FFFFFF' },
        { bg: '#F8CFC6', ink: '#3F5D8C' },
      ]);

  return {
    paper,
    pattern: pick(r, paper.patterns),
    shape: pick(r, ['wide', 'tall', 'square'] as Shape[]),
    tilt: between(r, -4, 4),
    knotX,
    knotY,
    twine,
    bowColor: twineColors[0],
    deco,
    decoRotation: between(r, -25, 25),
    showBow: deco === 'none' || r() < 0.45,
    tag: { ...tag, side: r() < 0.65 ? 'right' : 'left', rotation: between(r, -14, 14) },
    phase: between(r, 0, 12),
  };
}

/** The gifts are shuffled so today's present has to be found. */
// Gifts are rearranged daily (wrapping is then chosen so neighbours differ).
export const GIFT_ORDER = dailyDays(1712, TOTAL_DAYS);

function buildDesigns(): Record<number, GiftDesign> {
  const designs: Record<number, GiftDesign> = {};
  const r = rng(2026);
  GIFT_ORDER.forEach((day, pos) => {
    // Avoid repeating a paper next to or above itself in 3-, 4- and 5-column grids.
    const neighbours = [pos - 1, pos - 3, pos - 4, pos - 5]
      .filter((p) => p >= 0)
      .map((p) => designs[GIFT_ORDER[p]]?.paper.name);
    const options = [...PAPERS].sort(() => r() - 0.5);
    const paper = options.find((p) => !neighbours.includes(p.name)) ?? options[0];
    designs[day] = makeDesign(day, paper);
  });
  return designs;
}

export const GIFT_DESIGNS = buildDesigns();

export function patternImage(pattern: Pattern, color: string): string {
  const c = encodeURIComponent(color);
  const svg = (body: string) =>
    `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'>${body}</svg>")`;
  switch (pattern) {
    case 'dots':
      return svg(`<g fill='${c}'><circle cx='7' cy='7' r='2.3'/><circle cx='21' cy='21' r='2.3'/></g>`);
    case 'snow':
      return svg(
        `<g fill='${c}'><circle cx='4' cy='5' r='1.5'/><circle cx='17' cy='3' r='2.6'/><circle cx='10' cy='15' r='2'/><circle cx='24' cy='14' r='1.3'/><circle cx='5' cy='24' r='2.4'/><circle cx='19' cy='24' r='1.6'/></g>`,
      );
    case 'plus':
      return svg(
        `<g stroke='${c}' stroke-width='1.6' stroke-linecap='round'><path d='M7 4v6M4 7h6M21 18v6M18 21h6'/></g>`,
      );
    case 'plain':
      return 'none';
  }
}
