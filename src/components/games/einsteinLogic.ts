/**
 * "The Einstein puzzle": 4 suspects, 3 categories of 4 options each, and
 * structured clues, so the puzzle can be solved (and checked) by trying every
 * combination (24³ = 13,824).
 */

/** A thing a clue talks about: a suspect (cat = -1) or a category option. */
export type Ref = [cat: number, val: number];

export type Relation = 'is' | 'not' | 'neither' | 'next';

export interface Clue {
  a: Ref;
  rel: Relation;
  b: Ref;
  /** neither: the second option (same category as b) */
  b2?: Ref;
}

export interface Category {
  name: string;
  values: string[];
  /** e.g. "was in the" (the clue writes "Alice was in the library") */
  verb: string;
  /** e.g. "in the" (the clue writes "the person in the library") */
  noun: string;
  /** e.g. "did not live in the"; empty = worked out from `verb` ("was not in the"). */
  neg?: string;
  /** The options are in a row, in this order (enables "right next to"). */
  row?: boolean;
}

export interface EinsteinPuzzle {
  people: string[];
  categories: Category[];
  clues: Clue[];
  /** Whose is this? e.g. [2, 3] = the golden key. */
  question: Ref;
}

export const SIZE = 4;

export const EXAMPLE_EINSTEIN: EinsteinPuzzle = {
  people: ['Alice', 'Bob', 'Carol', 'David'],
  categories: [
    { name: 'Room', values: ['library', 'kitchen', 'ballroom', 'study'], verb: 'was in the', noun: 'in the' },
    { name: 'Drink', values: ['coffee', 'tea', 'hot chocolate', 'wine'], verb: 'was drinking', noun: 'drinking' },
    { name: 'Object', values: ['candle', 'silver bell', 'pocket watch', 'golden key'], verb: 'was carrying the', noun: 'carrying the' },
  ],
  clues: [
    { a: [-1, 0], rel: 'neither', b: [0, 1], b2: [0, 2] }, // Alice was not in the kitchen or the ballroom.
    { a: [0, 0], rel: 'is', b: [1, 0] }, // The person in the library was drinking coffee.
    { a: [-1, 1], rel: 'is', b: [2, 1] }, // Bob was carrying the silver bell.
    { a: [-1, 2], rel: 'is', b: [1, 2] }, // Carol was drinking hot chocolate.
    { a: [0, 0], rel: 'is', b: [2, 2] }, // The person in the library was carrying the pocket watch.
    { a: [-1, 3], rel: 'not', b: [0, 0] }, // David was not in the library.
    { a: [1, 1], rel: 'is', b: [0, 2] }, // The person drinking tea was in the ballroom.
    { a: [-1, 0], rel: 'neither', b: [2, 0], b2: [2, 3] }, // Alice was not carrying the candle or the golden key.
    { a: [0, 1], rel: 'is', b: [1, 3] }, // The person in the kitchen was drinking wine.
    { a: [-1, 1], rel: 'not', b: [0, 1] }, // Bob was not in the kitchen.
    { a: [2, 3], rel: 'is', b: [1, 2] }, // The person carrying the golden key was drinking hot chocolate.
  ],
  question: [2, 3],
};

export const EXAMPLE_STORY =
  'Four guests attended a mysterious Christmas Eve gathering. During the evening, someone stole the Golden Christmas Key 🗝️. Each guest was in a different room, drinking a different beverage, and carrying a different object.';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** "was in the" → "was not in the"; null when the verb has no helper word to negate (e.g. "lived"). */
export const autoNegative = (verb: string): string | null => {
  const [first, ...rest] = verb.trim().split(' ');
  return /^(was|is|were|are|had|has|could|would|did|does|will)$/i.test(first) ? [first, 'not', ...rest].join(' ') : null;
};
const negate = (c: Category) => c.neg?.trim() || autoNegative(c.verb) || `${c.verb.trim()} (not)`;
const article = (verb: string) => (/\bthe$/i.test(verb.trim()) ? 'the ' : '');

/** "Alice" or "the person in the library" */
export function subject(p: EinsteinPuzzle, [cat, val]: Ref): string {
  if (cat < 0) return p.people[val] || '…';
  const c = p.categories[cat];
  return `the person ${c.noun.trim()} ${c.values[val] || '…'}`.replace(/\s+/g, ' ');
}

/** "was in the library" / "was not in the library" / "was Alice" */
function predicate(p: EinsteinPuzzle, [cat, val]: Ref, neg: boolean): string {
  if (cat < 0) return `${neg ? 'was not' : 'was'} ${p.people[val] || '…'}`;
  const c = p.categories[cat];
  return `${neg ? negate(c) : c.verb.trim()} ${c.values[val] || '…'}`;
}

export function clueText(p: EinsteinPuzzle, clue: Clue): string {
  const s = cap(subject(p, clue.a));
  switch (clue.rel) {
    case 'is':
      return `${s} ${predicate(p, clue.b, false)}.`;
    case 'not':
      return `${s} ${predicate(p, clue.b, true)}.`;
    case 'neither': {
      const second = clue.b2 ? (clue.b2[0] < 0 ? p.people[clue.b2[1]] : `${article(p.categories[clue.b2[0]].verb)}${p.categories[clue.b2[0]].values[clue.b2[1]]}`) : '…';
      return `${s} ${predicate(p, clue.b, true)} or ${second}.`;
    }
    case 'next':
      return `${s} was right next to ${subject(p, clue.b)}.`;
  }
}

export function questionText(p: EinsteinPuzzle): string {
  const [cat, val] = p.question;
  const c = p.categories[cat];
  return c ? `Who ${c.verb.trim()} ${c.values[val]}?` : 'Who did it?';
}

/** Problems with the setup itself (before solving), or null. */
export function setupProblem(p: EinsteinPuzzle): string | null {
  if (p.people.length !== SIZE || p.people.some((x) => !x.trim())) return 'Every suspect needs a name.';
  if (new Set(p.people.map((x) => x.trim().toLowerCase())).size !== SIZE) return 'Give the suspects different names.';
  for (const c of p.categories) {
    if (!c.name.trim()) return 'Every category needs a name.';
    if (c.values.length !== SIZE || c.values.some((v) => !v.trim())) return `Fill in all four options for “${c.name}”.`;
    if (new Set(c.values.map((v) => v.trim().toLowerCase())).size !== SIZE) return `The options for “${c.name}” must be different.`;
    if (!c.verb.trim() || !c.noun.trim()) return `Fill in the wording for “${c.name}”.`;
  }
  if (!p.clues.length) return 'Add some clues.';
  for (const [i, c] of p.clues.entries()) {
    if (c.a[0] === c.b[0] && c.rel !== 'next') return `Clue ${i + 1} compares two things from the same group.`;
    if (c.rel === 'neither' && (!c.b2 || c.b2[0] !== c.b[0] || c.b2[1] === c.b[1])) return `Clue ${i + 1} needs two different options from the same group.`;
    if (c.rel === 'next' && !p.categories.some((x) => x.row)) return `Clue ${i + 1} uses “next to”: mark one category as being in a row.`;
    const negCat = (c.rel === 'not' || c.rel === 'neither') && c.b[0] >= 0 ? p.categories[c.b[0]] : null;
    if (negCat && !negCat.neg?.trim() && !autoNegative(negCat.verb)) return `Write the “not” wording for “${negCat.name}” (e.g. “did not live in the”), clue ${i + 1} needs it.`;
  }
  return null;
}

function permutations(n: number): number[][] {
  if (n === 1) return [[0]];
  return permutations(n - 1).flatMap((p) => Array.from({ length: n }, (_, i) => [...p.slice(0, i), n - 1, ...p.slice(i)]));
}
const PERMS = permutations(SIZE);

export interface SolveResult {
  /** How many full solutions fit the clues (capped at 50). */
  solutions: number;
  /** The suspect index answering the question, if every solution agrees. */
  answer: number | null;
  /** The first solution: option index per category per person. */
  example: number[][] | null;
}

/** Try every combination; assignment[cat][person] = option index. */
export function solve(p: EinsteinPuzzle): SolveResult {
  const cats = p.categories.length;
  const rowCat = p.categories.findIndex((c) => c.row);
  let solutions = 0;
  let answer: number | null | undefined;
  let example: number[][] | null = null;
  const assign: number[][] = Array.from({ length: cats }, () => []);
  const owner = (ref: Ref): number => (ref[0] < 0 ? ref[1] : assign[ref[0]].indexOf(ref[1]));
  const holds = (c: Clue): boolean => {
    const pa = owner(c.a);
    const pb = owner(c.b);
    switch (c.rel) {
      case 'is':
        return pa === pb;
      case 'not':
        return pa !== pb;
      case 'neither':
        return pa !== pb && (!c.b2 || pa !== owner(c.b2));
      case 'next':
        return rowCat >= 0 && Math.abs(assign[rowCat][pa] - assign[rowCat][pb]) === 1;
    }
  };
  const visit = (k: number) => {
    if (solutions >= 50) return;
    if (k === cats) {
      if (!p.clues.every(holds)) return;
      solutions++;
      const who = owner(p.question);
      answer = answer === undefined ? who : answer === who ? who : null;
      if (!example) example = assign.map((x) => [...x]);
      return;
    }
    for (const perm of PERMS) {
      assign[k] = perm;
      visit(k + 1);
    }
  };
  visit(0);
  return { solutions, answer: answer ?? null, example };
}
