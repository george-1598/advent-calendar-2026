import { between, pick, rng, shuffle } from '../../../lib/random';
import { TOTAL_DAYS } from '../../../lib/time';
import { dailyRng } from '../../../lib/daily';

export type MailKind = 'letter' | 'postcard' | 'parcel';

export interface Mail {
  id: string;
  /** null for decoys: children's letters to Santa, postcards and parcels. */
  day: number | null;
  kind: MailKind;
  /** Centre position on the desk, in % of the desk. */
  x: number;
  y: number;
  rot: number;
  paper: string;
  ink: string;
  airmail: boolean;
  stamp: { bg: string; art: 'tree' | 'star' | 'bell' | 'deer' };
  note: string;
}

const PAPERS = [
  { paper: '#F3EAD7', ink: '#2E3A5C' },
  { paper: '#E3CDA6', ink: '#4A2C18' },
  { paper: '#DCE7F0', ink: '#22355A' },
  { paper: '#F6E4E1', ink: '#7A231C' },
  { paper: '#EFE6C9', ink: '#2F4A3A' },
];
const STAMPS = ['#C8102E', '#1E7A46', '#1D4E9E', '#D4A017', '#6B2C91'];

/** Letters from children to Santa — the decoys. */
export const KID_LETTERS = [
  'Dear Santa,\nI have been mostly good. The cat incident was NOT my fault.\nLove, Oliver (age 7)',
  'Dear Santa,\nPlease bring me a pony. If a pony is too big, a small pony.\nThank you, Mia',
  'Dear Santa,\nHow do you fit down chimneys? Asking for a friend (me).\nLeo',
  'Dear Santa,\nI left you 3 cookies last year but my dad ate one. Sorry.\nGrace',
  'Dear Santa,\nCan the reindeer have carrots? I will leave the big ones.\nNoah',
  'Dear Santa,\nI would like snow. Lots of it. Enough to skip school.\nAva',
  'Dear Elves,\nPlease tell Santa my little brother deserves socks.\nLucas',
];
export const POSTCARD_NOTES = [
  'Greetings from the North Pole!\nWish you were here (it is very cold).\n— the Elves',
  'Weather: snowing.\nReindeer: well rested.\nSleigh: freshly polished.\n— Mrs Claus',
  'Wrapping department update:\nwe ran out of tape again.\n— Elf HQ',
];

const DECOY_PLAN: MailKind[] = ['letter', 'letter', 'letter', 'letter', 'letter', 'postcard', 'postcard', 'postcard', 'parcel', 'parcel'];

function build(): Mail[] {
  const r = rng(4512);
  const items: Mail[] = [];
  let kid = 0;
  let card = 0;
  const all: { day: number | null; kind: MailKind }[] = [
    ...Array.from({ length: TOTAL_DAYS }, (_, i) => ({ day: i + 1, kind: 'letter' as MailKind })),
    ...DECOY_PLAN.map((kind) => ({ day: null, kind })),
  ];
  // Spots and paper stay the same; which letter lands where changes daily.
  shuffle(dailyRng(4512), all).forEach((m, i) => {
    const p = pick(r, PAPERS);
    items.push({
      id: m.day ? `day-${m.day}` : `decoy-${i}`,
      day: m.day,
      kind: m.kind,
      x: between(r, 18, 82),
      y: between(r, 10, 90),
      rot: between(r, -24, 24),
      ...p,
      airmail: m.kind === 'letter' && r() < 0.28,
      stamp: { bg: pick(r, STAMPS), art: pick(r, ['tree', 'star', 'bell', 'deer'] as const) },
      note:
        m.kind === 'postcard'
          ? POSTCARD_NOTES[card++ % POSTCARD_NOTES.length]
          : m.kind === 'letter' && !m.day
            ? KID_LETTERS[kid++ % KID_LETTERS.length]
            : '',
    });
  });
  return items;
}

export const MAIL = build();
