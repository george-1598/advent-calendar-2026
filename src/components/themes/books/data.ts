import { between, pick, rng, shuffle } from '../../../lib/random';
import { TOTAL_DAYS } from '../../../lib/time';

export type Motif = 'holly' | 'tree' | 'star' | 'candle' | 'bird' | 'none';
export type Orientation = 'upright' | 'lean' | 'flat' | 'cover';

export interface BookSpec {
  id: string;
  /** null for decoy books that aren't a day. */
  day: number | null;
  orientation: Orientation;
  /** Spine thickness and length in shelf units (a shelf row is 100 units tall). */
  width: number;
  height: number;
  color: string;
  ink: string;
  /** Gold-stamped lettering (vs. dark ink on pale books). */
  gilt: boolean;
  lean: number;
  overlap: number;
  bands: number[];
  motif: Motif;
  numberTop: number;
  numberSide: 'left' | 'right';
  title: string;
  quote: string;
}

export type ShelfItem = { kind: 'book'; book: BookSpec } | { kind: 'stack'; books: BookSpec[] };

const PALETTE = [
  { color: '#8E2A24', ink: '#E7C77E', gilt: true },
  { color: '#6A1C1A', ink: '#E2BE6F', gilt: true },
  { color: '#2C5639', ink: '#E7C77E', gilt: true },
  { color: '#1C3A2A', ink: '#D9B66A', gilt: true },
  { color: '#21324F', ink: '#E2C27A', gilt: true },
  { color: '#2A5860', ink: '#EBD08F', gilt: true },
  { color: '#B5822E', ink: '#3E1F0E', gilt: false },
  { color: '#DED0B0', ink: '#7A231C', gilt: false },
  { color: '#A94B27', ink: '#F3DDA6', gilt: true },
  { color: '#50283F', ink: '#E7C77E', gilt: true },
  { color: '#5B3A26', ink: '#E2C27A', gilt: true },
];

// Short, readable titles.
const TITLES = [
  'Noel', 'Holly', 'Snow', 'Frost', 'Yule', 'Carols', 'Tinsel', 'Stars', 'Mittens', 'Cocoa',
  'Ginger', 'Robin', 'Bells', 'Wreath', 'Winter', 'Embers', 'Sleigh', 'Candles', 'Pine', 'Velvet',
  'Lanterns', 'Snowfall', 'Nutmeg', 'Garland', 'Reindeer', 'Wishes', 'Firelight', 'Cinnamon',
  'Twilight', 'Ribbons', 'Icicles', 'Chestnuts', 'Joy', 'Peace', 'Angels', 'Evergreen', 'Fir', 'Gifts',
];

const QUOTES = [
  'Christmas waves a magic wand over this world, and behold, everything is softer and more beautiful.',
  'The best of all gifts around any Christmas tree: the presence of a happy family all wrapped up in each other.',
  'Peace on earth will come to stay, when we live Christmas every day.',
  'It is Christmas in the heart that puts Christmas in the air.',
  'Blessed is the season which engages the whole world in a conspiracy of love.',
  'Snowflakes are kisses from heaven.',
  'Christmas is not a time nor a season, but a state of mind.',
  'The most wonderful time of the year is the one spent with you.',
  'May your days be merry and bright.',
  'Let it snow, let it snow, let it snow.',
];

const MOTIFS: Motif[] = ['holly', 'tree', 'star', 'candle', 'bird', 'none', 'none'];
const DECOYS = 13;
const COVER_DAYS = new Set([4, 11, 17, 23]);

function buildShelf(): ShelfItem[] {
  const r = rng(1843);
  const ids: (number | null)[] = [
    ...Array.from({ length: TOTAL_DAYS }, (_, i) => i + 1),
    ...Array.from({ length: DECOYS }, () => null),
  ];
  const titles = shuffle(r, TITLES);
  let decoyIndex = 0;

  const books = ids.map((day, i): BookSpec => {
    const palette = pick(r, PALETTE);
    const cover = day !== null && COVER_DAYS.has(day);
    return {
      id: day ? `day-${day}` : `decoy-${decoyIndex++}`,
      day,
      orientation: cover ? 'cover' : 'upright',
      width: cover ? between(r, 54, 62) : between(r, 18, 28),
      height: cover ? between(r, 80, 90) : between(r, 72, 94),
      ...palette,
      lean: 0,
      overlap: r() < 0.45 ? between(r, 1, 3.5) : 0,
      bands: [between(r, 6, 12), between(r, 84, 92), ...(r() < 0.5 ? [between(r, 66, 74)] : [])],
      motif: pick(r, MOTIFS),
      numberTop: between(r, 62, 76),
      numberSide: r() < 0.5 ? 'left' : 'right',
      title: titles[i % titles.length],
      quote: pick(r, QUOTES),
    };
  });

  // Mix them up, then lay some flat in little stacks and lean a few.
  const order = shuffle(rng(77), books);
  const items: ShelfItem[] = [];
  const sr = rng(5150);
  let i = 0;
  while (i < order.length) {
    const book = order[i];
    const canStack = book.orientation === 'upright' && order[i + 1]?.orientation === 'upright';
    if (canStack && items.length > 1 && sr() < 0.16) {
      const count = sr() < 0.5 ? 2 : 3;
      const stack = order.slice(i, i + count).filter((b) => b.orientation === 'upright');
      stack.forEach((b) => {
        b.orientation = 'flat';
        b.width = between(sr, 13, 18); // thickness when lying down
        b.height = between(sr, 62, 78); // length
        b.overlap = 0;
      });
      items.push({ kind: 'stack', books: stack });
      i += stack.length;
      continue;
    }
    if (book.orientation === 'upright' && sr() < 0.14) {
      book.orientation = 'lean';
      book.lean = (sr() < 0.5 ? -1 : 1) * between(sr, 9, 15);
      book.overlap = 0;
    }
    items.push({ kind: 'book', book });
    i++;
  }
  return items;
}

export const SHELF = buildShelf();
export const BOOKS = SHELF.flatMap((item) => (item.kind === 'book' ? [item.book] : item.books));
