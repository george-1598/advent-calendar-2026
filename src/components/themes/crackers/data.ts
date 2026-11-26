import { pick, rng, shuffle } from '../../../lib/random';
import { TOTAL_DAYS } from '../../../lib/time';
import { dailyDays } from '../../../lib/daily';

export const JOKES: [string, string][] = [
  ['What do you call an obnoxious reindeer?', 'Rude-olph.'],
  ['What do snowmen eat for breakfast?', 'Frosted flakes.'],
  ['Why was the snowman looking through the carrots?', 'He was picking his nose.'],
  ['What do you get if you cross a snowman with a vampire?', 'Frostbite.'],
  ['How does a sheep say Merry Christmas?', 'Fleece Navidad!'],
  ['What’s every elf’s favourite kind of music?', 'Wrap.'],
  ['Why did the turkey join the band?', 'Because it had the drumsticks.'],
  ['What do you call a cat on the beach at Christmas?', 'Sandy Claws.'],
  ['What do angry mice send at Christmas?', 'Cross-mouse cards.'],
  ['Why is it so cold at Christmas?', 'Because it’s Decembrrrr.'],
  ['What did the gingerbread man put on his bed?', 'A cookie sheet.'],
  ['How do snowmen get around?', 'They ride an icicle.'],
  ['What’s the best Christmas present?', 'A broken drum — you can’t beat it.'],
  ['Why did the Christmas tree go to the barber?', 'It needed a trim.'],
  ['What do you call a snowman with a six-pack?', 'An abdominal snowman.'],
  ['Who delivers presents to baby sharks?', 'Santa Jaws.'],
  ['What did Adam say the day before Christmas?', 'It’s Christmas, Eve!'],
  ['What kind of motorbike does Santa ride?', 'A Holly Davidson.'],
  ['Why does Santa never get sick?', 'He has private elf care.'],
  ['How do Christmas trees get ready for a night out?', 'They spruce up.'],
  ['What did one snowman say to the other?', 'Can you smell carrots?'],
  ['What do elves learn at school?', 'The elf-abet.'],
  ['Why are Christmas trees bad at knitting?', 'They always drop their needles.'],
  ['What do you call Santa when he takes a break?', 'Santa Pause.'],
  ['What is a reindeer’s favourite game?', 'Stable tennis.'],
];

export interface CrackerDesign {
  day: number;
  a: string;
  b: string;
  band: string;
  pattern: 'stars' | 'stripes' | 'dots' | 'snow';
  crown: string;
  joke: [string, string];
}

const FOILS = [
  { a: '#C8102E', b: '#FF6B6B' },
  { a: '#1E7A46', b: '#5FD08F' },
  { a: '#B8860B', b: '#FFE08A' },
  { a: '#1D4E9E', b: '#7FB2FF' },
  { a: '#7D8A99', b: '#F2F5F8' },
  { a: '#6B2C91', b: '#C98BFF' },
];
const CROWNS = ['#FF6B6B', '#7FD3A0', '#7FB2FF', '#F7A6D8', '#FFD166'];

// Crackers are rearranged daily.
export const CRACKER_ORDER = dailyDays(2512, TOTAL_DAYS);

export const CRACKERS: Record<number, CrackerDesign> = (() => {
  const r = rng(77);
  const jokes = shuffle(r, JOKES);
  const out: Record<number, CrackerDesign> = {};
  let prev = '';
  CRACKER_ORDER.forEach((day, i) => {
    let foil = pick(r, FOILS);
    while (foil.a === prev) foil = pick(r, FOILS);
    prev = foil.a;
    out[day] = {
      day,
      ...foil,
      band: r() < 0.5 ? '#E7C77E' : '#E8EEF4',
      pattern: pick(r, ['stars', 'stripes', 'dots', 'snow'] as const),
      crown: pick(r, CROWNS),
      joke: jokes[i % jokes.length],
    };
  });
  return out;
})();
