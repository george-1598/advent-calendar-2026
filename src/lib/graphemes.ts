/** Split text into user-visible characters (an emoji like 👨‍👩‍👧 counts as one). */
export function graphemes(text: string): string[] {
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment: (s: string) => Iterable<{ segment: string }> } }).Segmenter;
  if (Seg) return Array.from(new Seg(undefined, { granularity: 'grapheme' }).segment(text), (s) => s.segment);
  return Array.from(text);
}

export const BADGE_COUNT = 25;

/** A phrase as 25 badge characters (spaces dropped, padded with the filler) and its word lengths. */
export function badgeChars(phrase: string, filler: string): { chars: string[]; layout: number[]; used: number; tooLong: boolean } {
  const words = phrase.trim().split(/\s+/).filter(Boolean).map((w) => graphemes(w.toLocaleUpperCase()));
  const used = words.reduce((n, w) => n + w.length, 0);
  const pad = Math.max(0, BADGE_COUNT - used);
  const chars = [...words.flat(), ...Array(pad).fill(filler)];
  const layout = [...words.map((w) => w.length), ...(pad ? [pad] : [])];
  return { chars, layout, used, tooLong: used > BADGE_COUNT };
}
