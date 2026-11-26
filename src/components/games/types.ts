export type GameKind = 'riddle' | 'wordle' | 'song' | 'map' | 'quiz' | 'timeline' | 'anagram' | 'treasure';

export const GAME_KINDS: { id: GameKind; label: string }[] = [
  { id: 'riddle', label: 'Riddle / question (type the answer)' },
  { id: 'wordle', label: 'Wordle (guess the word)' },
  { id: 'song', label: 'Song guess (melody or audio)' },
  { id: 'map', label: 'Map pin (where was it?)' },
  { id: 'quiz', label: 'Quiz (multiple choice)' },
  { id: 'timeline', label: 'Our timeline (put in order)' },
  { id: 'anagram', label: 'Anagram (unscramble the letters)' },
  { id: 'treasure', label: 'Treasure hunt (code / QR)' },
];

export interface GameContent {
  prompt?: string;
  /** wordle */
  length?: number;
  /** song: space-separated notes like "E5 E5 E5:2 -" */
  melody?: string;
  tempo?: number;
  audioUrl?: string;
  /** map: the player's starting view */
  center?: [number, number];
  zoom?: number;
  /** quiz */
  questions?: { q: string; options: string[] }[];
  /** timeline (shown shuffled) */
  items?: { id: string; text: string }[];
  /** anagram */
  letters?: string;
}

export interface GameProps {
  day: number;
  content: GameContent;
  solved: boolean;
  /** Treasure hunt: a code that arrived via QR link. */
  code?: string;
}
