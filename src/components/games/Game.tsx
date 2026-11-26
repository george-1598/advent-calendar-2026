import { Suspense, lazy, type ComponentType } from 'react';
import type { GameKind, GameProps } from './types';

// The map (Leaflet) is big, so it loads only when a map day is opened.
const MapPin = lazy(() => import('./MapPin'));
import Riddle from './Riddle';
import Wordle from './Wordle';
import Song from './Song';
import Quiz from './Quiz';
import Timeline from './Timeline';
import Anagram from './Anagram';
import Treasure from './Treasure';
import Morse from './Morse';
import ZoomReveal from './ZoomReveal';
import Memory from './Memory';
import Emoji from './Emoji';
import Hangman from './Hangman';
import Cipher from './Cipher';
import HotCold from './HotCold';
import Truths from './Truths';
import Suspects from './Suspects';
import Einstein from './Einstein';
// Chain renders other games, so it's loaded lazily to avoid a circular import at startup.
const Chain = lazy(() => import('./Chain'));

const GAMES: Record<GameKind, ComponentType<GameProps>> = {
  riddle: Riddle,
  wordle: Wordle,
  song: Song,
  map: MapPin,
  quiz: Quiz,
  timeline: Timeline,
  anagram: Anagram,
  treasure: Treasure,
  morse: Morse,
  zoom: ZoomReveal,
  memory: Memory,
  emoji: Emoji,
  hangman: Hangman,
  cipher: Cipher,
  hotcold: HotCold,
  truths: Truths,
  suspects: Suspects,
  einstein: Einstein,
  chain: Chain,
};

/** Renders the right game for a day's quest. */
export default function Game({ kind, ...props }: GameProps & { kind: string }) {
  const Component = GAMES[kind as GameKind] ?? Riddle;
  return (
    <Suspense fallback={<p className="game-help">Loading the game…</p>}>
      <Component {...props} />
    </Suspense>
  );
}
