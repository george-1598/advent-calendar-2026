import { pick, rng, shuffle } from '../../../lib/random';
import { TOTAL_DAYS } from '../../../lib/time';
import { dailyRng } from '../../../lib/daily';

export const VIEW_W = 1200;
export const VIEW_H = 800;
export const GROUND = 640;

export type Interior = 'tree' | 'fireplace' | 'cat' | 'candles' | 'gifts' | 'lamp' | 'stocking' | 'frame' | 'calendar' | 'books';
const DECOR: Interior[] = ['tree', 'fireplace', 'cat', 'candles', 'gifts', 'lamp', 'books'];
const NUMBERED: Interior[] = ['frame', 'stocking', 'calendar'];
const WALLS = ['#F6C77A', '#F3B36B', '#F7D48F', '#EFA46A', '#F2C08A'];

export interface WindowSpec {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  day: number | null;
  interior: Interior;
  /** Decor item shown next to the number in numbered rooms. */
  extra: Interior;
  wall: string;
  arched: boolean;
}

export interface HouseSpec {
  x: number;
  w: number;
  h: number;
  body: string;
  trim: string;
  material: 'planks' | 'bricks' | 'plaster';
  roofPeak: number;
  chimney: number | null;
  door: { x: number; y: number; w: number; h: number; color: string } | null;
  garlandY: number;
  windows: WindowSpec[];
}

const RAW = [
  { x: 30, w: 220, h: 290, body: '#5E84B4', trim: '#E9EEF6', material: 'planks', rows: 2, cols: 3, chimney: 0.72 },
  { x: 250, w: 170, h: 370, body: '#B4453A', trim: '#F3E6D2', material: 'planks', rows: 3, cols: 2, chimney: null },
  { x: 420, w: 240, h: 270, body: '#D8C39A', trim: '#6B4A2E', material: 'plaster', rows: 2, cols: 3, chimney: 0.28 },
  { x: 660, w: 160, h: 340, body: '#8B5A46', trim: '#F1E2CC', material: 'bricks', rows: 3, cols: 2, chimney: 0.7 },
  { x: 820, w: 220, h: 300, body: '#4F7A6F', trim: '#EEF2EC', material: 'planks', rows: 2, cols: 3, chimney: null },
  { x: 1040, w: 140, h: 360, body: '#A43C3F', trim: '#F5E7D4', material: 'planks', rows: 3, cols: 2, chimney: 0.35 },
] as const;

function build(): HouseSpec[] {
  const r = rng(808);
  let id = 0;
  const houses: HouseSpec[] = RAW.map((h) => {
    const top = GROUND - h.h;
    const cellW = h.w / h.cols;
    const winW = Math.min(cellW * 0.52, 46);
    const winH = winW * 1.32;
    const areaTop = top + 34;
    const areaH = h.h - 50;
    const cellH = areaH / h.rows;
    const windows: WindowSpec[] = [];
    let door: HouseSpec['door'] = null;
    for (let row = 0; row < h.rows; row++) {
      for (let col = 0; col < h.cols; col++) {
        const cx = h.x + cellW * (col + 0.5);
        const cy = areaTop + cellH * (row + 0.5);
        const isDoor = h.cols === 3 && row === h.rows - 1 && col === 1;
        if (isDoor) {
          const dw = winW * 1.05;
          const dh = GROUND - (cy - winH / 2) - 2;
          door = { x: cx - dw / 2, y: GROUND - dh, w: dw, h: dh, color: pick(r, ['#7A1F1C', '#2F4A3A', '#3A2A20']) };
          continue;
        }
        windows.push({
          id: id++,
          x: cx - winW / 2,
          y: cy - winH / 2,
          w: winW,
          h: winH,
          day: null,
          interior: pick(r, DECOR),
          extra: pick(r, DECOR),
          wall: pick(r, WALLS),
          arched: r() < 0.3,
        });
      }
    }
    return {
      x: h.x,
      w: h.w,
      h: h.h,
      body: h.body,
      trim: h.trim,
      material: h.material,
      roofPeak: h.w * (h.cols === 2 ? 0.62 : 0.42),
      chimney: h.chimney,
      door,
      garlandY: top + 22,
      windows,
    };
  });

  // Hide the 25 days among the windows.
  const all = houses.flatMap((h) => h.windows);
  // The village stays the same; which window hides which day changes daily.
  const dr = dailyRng(808);
  const chosen = shuffle(dr, all).slice(0, TOTAL_DAYS);
  const days = shuffle(dr, Array.from({ length: TOTAL_DAYS }, (_, i) => i + 1));
  chosen.forEach((w, i) => {
    w.day = days[i];
    w.interior = pick(r, NUMBERED);
  });
  return houses;
}

export const HOUSES = build();
export const WINDOW_COUNT = HOUSES.reduce((n, h) => n + h.windows.length, 0);

const sr = rng(99);
export const STARS = Array.from({ length: 90 }, () => ({
  x: sr() * VIEW_W,
  y: sr() * 330,
  r: 0.6 + sr() * 1.4,
  twinkle: sr() < 0.35,
  delay: sr() * 4,
}));
export const SNOW = Array.from({ length: 70 }, () => ({
  x: sr() * VIEW_W,
  r: 1 + sr() * 2.4,
  dur: 7 + sr() * 9,
  delay: -sr() * 16,
  drift: (sr() - 0.5) * 60,
}));
