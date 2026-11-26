import type { CSSProperties } from 'react';
import { dailyDays } from '../lib/daily';

export type TileColor = 'sage' | 'coral' | 'teal';

/** Colour of a day at each breakpoint: [phone 3 cols, tablet 4 cols, desktop 6 cols]. */
type DayColors = [TileColor, TileColor, TileColor];

export type LayoutItem =
  /** `slot` is the spot's original day: its colours were chosen so neighbours differ. */
  | { kind: 'day'; day: number; slot: number }
  | { kind: 'intro' | 'logo' | 'badges' | 'howto' };

const d = (day: number): LayoutItem => ({ kind: 'day', day, slot: day });

/**
 * Tile order for the calendar grid (`grid-auto-flow: dense`). With the spans in
 * styles.css this fills complete rows at every breakpoint: 3×11, 4×9 and 6×6.
 */
const BASE: LayoutItem[] = [
  { kind: 'intro' },
  d(11), d(5), d(2), d(19), d(16), d(9),
  { kind: 'logo' },
  d(21), d(7), d(12), d(17), d(10), d(4), d(15), d(8), d(18),
  { kind: 'howto' },
  d(1), d(22), d(3),
  { kind: 'badges' },
  d(23), d(14), d(13), d(24), d(25), d(20), d(6),
];

/** Today's grid: same spots and colours, days rearranged once a day. */
const TODAY = dailyDays(4242);
export const LAYOUT: LayoutItem[] = BASE.map((item) => (item.kind === 'day' ? { ...item, day: TODAY[item.slot - 1] } : item));

/**
 * Because tiles neighbour each other differently at each breakpoint, no single
 * colouring avoids same-colour neighbours everywhere. Each breakpoint gets its
 * own colouring (generated so no two touching days share a colour).
 */
const DAY_COLORS: Record<number, DayColors> = {
  1: ['teal', 'teal', 'sage'],
  2: ['sage', 'coral', 'teal'],
  3: ['teal', 'coral', 'teal'],
  4: ['sage', 'sage', 'coral'],
  5: ['coral', 'teal', 'coral'],
  6: ['teal', 'sage', 'teal'],
  7: ['teal', 'coral', 'teal'],
  8: ['sage', 'sage', 'sage'],
  9: ['coral', 'coral', 'coral'],
  10: ['coral', 'teal', 'sage'],
  11: ['teal', 'coral', 'sage'],
  12: ['coral', 'sage', 'sage'],
  13: ['sage', 'teal', 'sage'],
  14: ['coral', 'sage', 'coral'],
  15: ['teal', 'coral', 'teal'],
  16: ['sage', 'teal', 'teal'],
  17: ['sage', 'coral', 'teal'],
  18: ['teal', 'coral', 'coral'],
  19: ['coral', 'sage', 'sage'],
  20: ['coral', 'teal', 'sage'],
  21: ['coral', 'teal', 'coral'],
  22: ['sage', 'teal', 'sage'],
  23: ['teal', 'coral', 'coral'],
  24: ['coral', 'teal', 'teal'],
  25: ['teal', 'sage', 'coral'],
};

/** CSS variables consumed by `.day-color` to pick the right colour per breakpoint. */
export function dayColorStyle(day: number): CSSProperties {
  const [phone, tablet, desktop] = DAY_COLORS[day];
  return {
    '--c-phone': `var(--${phone})`,
    '--c-tablet': `var(--${tablet})`,
    '--c-desktop': `var(--${desktop})`,
  } as CSSProperties;
}
