import { now } from './time';
import { rng, shuffle } from './random';

/**
 * Today's date in Bucharest as a number (e.g. 20261207). Calendar layouts mix it
 * into their seeds, so the days are rearranged once a day (the same for everyone,
 * and stable for the whole day, including when coming back from a day page).
 */
export const TODAY_KEY = (() => {
  const d = new Date(now() + 2 * 3_600_000);
  return d.getUTCFullYear() * 10_000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
})();

/** A random generator that changes every day; `salt` keeps each theme's shuffle independent. */
export const dailyRng = (salt: number) => rng((Math.imul(TODAY_KEY, 2_654_435_761) ^ Math.imul(salt, 40_503)) >>> 0);

/** Days 1–25 in today's order for a given theme. */
export const dailyDays = (salt: number, count = 25) => shuffle(dailyRng(salt), Array.from({ length: count }, (_, i) => i + 1));
