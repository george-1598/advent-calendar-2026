import { between, pick, rng, shuffle } from '../../../lib/random';
import { TOTAL_DAYS } from '../../../lib/time';

export type Motif = 'holly' | 'tree' | 'star' | 'candle' | 'bird' | 'none';

export interface BookSpec {
  id: string;
  /** null for decoy books that aren't a day. */
  day: number | null;
  /** 'cover' books face outwards, showing their front cover. */
  kind: 'spine' | 'cover';
  /** Size in shelf units (a shelf row is 100 units tall). */
  width: number;
  height: number;
  color: string;
  ink: string;
  lean: number;
  overlap: number;
  bands: number[];
  motif: Motif;
  numberTop: number;
  numberSide: 'left' | 'right';
  title: string;
  quote: string;
}

const PALETTE = [
  { color: '#A8322D', ink: '#E7C77E' },
  { color: '#7C1F1D', ink: '#E2BE6F' },
  { color: '#2F5E3F', ink: '#E7C77E' },
  { color: '#1E3F2E', ink: '#D9B66A' },
  { color: '#22355A', ink: '#E2C27A' },
  { color: '#2C5F67', ink: '#EBD08F' },
  { color: '#C28A2C', ink: '#4A2612' },
  { color: '#E6D9BC', ink: '#8A2A22' },
  { color: '#C2552B', ink: '#F3DDA6' },
  { color: '#5B2E4A', ink: '#E7C77E' },
];

const TITLES = [
  'A Christmas Tale', 'Frost & Firelight', 'The Snow Garden', 'Letters to the North', 'The Midnight Star',
  'Winter Lanterns', 'The Holly Book', 'Carols by Candlelight', 'The Little Fir Tree', 'Tales of the Yule Log',
  'The Gingerbread Atlas', 'A Robin in December', 'The Silver Bells', 'Under the Mistletoe', 'The Night Before',
  'Stories by the Fire', 'The Paper Snowflake', 'Sleigh Bells', 'The Velvet Ribbon', 'A Winter Hamper',
  'The Lamplighter', 'Christmas Cookery', 'Songs of the Season', 'The Frozen Lake', 'A Pocket of Stars',
  'The Wreath Maker', 'Cinnamon & Clove', 'Northern Lights', 'The Toymaker’s Shop', 'An Evergreen Year',
  'The Reindeer Road', 'Hot Cocoa Mornings', 'The Snowed-In Inn', 'A Book of Wishes', 'Twelve Little Nights',
  'The Ornament Box', 'Starlight Stories', 'The Ice Skater',
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
// Four days get face-out covers, like the big illustrated books on a real shelf.
const COVER_DAYS = new Set([4, 11, 17, 23]);

function buildBooks(): BookSpec[] {
  const r = rng(1843);
  const ids: (number | null)[] = [
    ...Array.from({ length: TOTAL_DAYS }, (_, i) => i + 1),
    ...Array.from({ length: DECOYS }, () => null),
  ];
  const titles = shuffle(r, TITLES);
  let decoyIndex = 0;

  const books = ids.map((day, i): BookSpec => {
    const palette = pick(r, PALETTE);
    const kind = day && COVER_DAYS.has(day) ? 'cover' : 'spine';
    const bands = Array.from({ length: 2 + Math.floor(r() * 3) }, () => between(r, 6, 94)).sort((a, b) => a - b);
    return {
      id: day ? `day-${day}` : `decoy-${decoyIndex++}`,
      day,
      kind,
      width: kind === 'cover' ? between(r, 54, 62) : between(r, 14, 26),
      height: kind === 'cover' ? between(r, 80, 90) : between(r, 70, 95),
      color: palette.color,
      ink: palette.ink,
      lean: kind === 'spine' && r() < 0.18 ? between(r, -6, 6) : 0,
      overlap: r() < 0.55 ? between(r, 1.5, 4.5) : 0,
      bands,
      motif: pick(r, MOTIFS),
      numberTop: between(r, 18, 72),
      numberSide: r() < 0.5 ? 'left' : 'right',
      title: titles[i % titles.length],
      quote: pick(r, QUOTES),
    };
  });
  return shuffle(rng(77), books);
}

export const BOOKS = buildBooks();
