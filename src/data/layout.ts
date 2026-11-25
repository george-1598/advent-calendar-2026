export type TileColor = 'sage' | 'coral' | 'teal';

export type LayoutItem =
  | { kind: 'day'; day: number; color: TileColor }
  | { kind: 'intro' | 'logo' | 'countdown' | 'badges' | 'howto' };

const d = (day: number, color: TileColor): LayoutItem => ({ kind: 'day', day, color });

/**
 * Tile order for the calendar grid. The grid uses `grid-auto-flow: dense`, and
 * this order fills a perfect 6×6 (desktop), 4×9 (tablet) and 3×13 (phone) grid.
 * If you reorder, keep the special tiles roughly where they are.
 */
export const LAYOUT: LayoutItem[] = [
  { kind: 'intro' }, d(11, 'sage'), d(5, 'sage'), d(2, 'sage'), d(19, 'sage'),
  d(16, 'coral'), { kind: 'logo' }, d(9, 'teal'),
  d(21, 'sage'), d(7, 'sage'), d(12, 'coral'), d(17, 'sage'), d(10, 'teal'), d(4, 'coral'),
  d(15, 'sage'), { kind: 'countdown' }, d(8, 'coral'), { kind: 'howto' },
  d(18, 'teal'), { kind: 'badges' }, d(1, 'sage'), d(22, 'teal'), d(3, 'sage'), d(23, 'sage'),
  d(14, 'teal'), d(13, 'sage'), d(24, 'coral'), d(25, 'teal'), d(20, 'coral'), d(6, 'teal'),
];

export function colorOfDay(day: number): TileColor {
  const item = LAYOUT.find((i) => i.kind === 'day' && i.day === day);
  return item && item.kind === 'day' ? item.color : 'teal';
}
