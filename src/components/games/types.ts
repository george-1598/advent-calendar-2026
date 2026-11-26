export type GameKind =
  | 'riddle' | 'wordle' | 'song' | 'map' | 'quiz' | 'timeline' | 'anagram' | 'treasure'
  | 'morse' | 'zoom' | 'memory' | 'emoji' | 'hangman' | 'cipher' | 'hotcold'
  | 'truths' | 'chain' | 'suspects' | 'einstein' | 'wavelength';

export const GAME_KINDS: { id: GameKind; label: string }[] = [
  { id: 'riddle', label: 'Riddle / question (type the answer)' },
  { id: 'wordle', label: 'Wordle (guess the word)' },
  { id: 'song', label: 'Song guess (melody or audio)' },
  { id: 'map', label: 'Map pin (where was it?)' },
  { id: 'quiz', label: 'Quiz (multiple choice)' },
  { id: 'timeline', label: 'Our timeline (put in order)' },
  { id: 'anagram', label: 'Anagram (unscramble the letters)' },
  { id: 'treasure', label: 'Treasure hunt (code / QR)' },
  { id: 'morse', label: 'Morse lights (decode the blinking)' },
  { id: 'zoom', label: 'Zoom reveal (guess the photo)' },
  { id: 'memory', label: 'Memory match (photo pairs)' },
  { id: 'emoji', label: 'Emoji riddle' },
  { id: 'hangman', label: 'Hangman (save the snowman)' },
  { id: 'cipher', label: 'Cipher wheel (decode the message)' },
  { id: 'hotcold', label: 'Hot & cold (find the spot in a photo)' },
  { id: 'truths', label: 'Two truths and a lie' },
  { id: 'suspects', label: 'The four suspects (who did it?)' },
  { id: 'einstein', label: 'Einstein puzzle (logic grid mystery)' },
  { id: 'wavelength', label: 'Wavelength (set the needle on a scale)' },
  { id: 'chain', label: 'Multi-step chain (several games in a row)' },
];

/** Answer stored for memory match (finishing the board is the solution). */
export const MEMORY_DONE = 'memory complete';

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
  /** morse: dots/dashes, letters separated by spaces, words by " / " */
  morse?: string;
  /** zoom / hotcold: storage path of the photo */
  image?: string;
  /** zoom: where the zoom starts (0–1) and how many steps to zoom out */
  focus?: { x: number; y: number };
  steps?: number;
  /** memory: storage paths of the photos (each becomes a pair) */
  images?: string[];
  /** emoji */
  emojis?: string;
  emojiHints?: string[];
  /** hangman: the answer with letters as "_" (spaces kept) */
  mask?: string;
  /** cipher: the encrypted message */
  cipher?: string;
  /** truths: three statements per round */
  rounds?: { statements: string[] }[];
  /** suspects: four people, each with one structured statement */
  suspects?: { name: string; says: { type: 'did' | 'didnt' | 'lying' | 'truthful'; target: number } }[];
  /** einstein: suspects, categories, structured clues and the question */
  einstein?: import('./einsteinLogic').EinsteinPuzzle;
  /** wavelength: the two ends of the scale and the clue */
  spectrum?: { left: string; right: string; clue: string };
  /** chain: the games, in order */
  parts?: { kind: GameKind; content: GameContent }[];
}

export interface GameProps {
  day: number;
  content: GameContent;
  solved: boolean;
  /** Treasure hunt: a code that arrived via QR link. */
  code?: string;
  /** Set when this game is one step of a chain (0-based). */
  step?: number;
}
