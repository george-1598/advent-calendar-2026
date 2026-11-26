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

const GAMES: Record<GameKind, ComponentType<GameProps>> = {
  riddle: Riddle,
  wordle: Wordle,
  song: Song,
  map: MapPin,
  quiz: Quiz,
  timeline: Timeline,
  anagram: Anagram,
  treasure: Treasure,
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
