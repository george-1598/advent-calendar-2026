import { Suspense, lazy, type ComponentType } from 'react';
import { reloadIfStale } from '../../lib/staleReload';
import type { GameKind, GameProps } from './types';

// The map (Leaflet) is big, so it loads only when a map day is opened.
const MapPin = lazy(() => reloadIfStale(import('./MapPin')));
// Chain renders other games, so it's loaded lazily to avoid a circular import at startup.
const Chain = lazy(() => reloadIfStale(import('./Chain')));

// Each game loads only when a day with that game is opened.
const Riddle = lazy(() => reloadIfStale(import('./Riddle')));
const Wordle = lazy(() => reloadIfStale(import('./Wordle')));
const Song = lazy(() => reloadIfStale(import('./Song')));
const Quiz = lazy(() => reloadIfStale(import('./Quiz')));
const Timeline = lazy(() => reloadIfStale(import('./Timeline')));
const Anagram = lazy(() => reloadIfStale(import('./Anagram')));
const Treasure = lazy(() => reloadIfStale(import('./Treasure')));
const Morse = lazy(() => reloadIfStale(import('./Morse')));
const ZoomReveal = lazy(() => reloadIfStale(import('./ZoomReveal')));
const Memory = lazy(() => reloadIfStale(import('./Memory')));
const Emoji = lazy(() => reloadIfStale(import('./Emoji')));
const Hangman = lazy(() => reloadIfStale(import('./Hangman')));
const Cipher = lazy(() => reloadIfStale(import('./Cipher')));
const HotCold = lazy(() => reloadIfStale(import('./HotCold')));
const Truths = lazy(() => reloadIfStale(import('./Truths')));
const Suspects = lazy(() => reloadIfStale(import('./Suspects')));
const Einstein = lazy(() => reloadIfStale(import('./Einstein')));
const Wavelength = lazy(() => reloadIfStale(import('./Wavelength')));

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
  wavelength: Wavelength,
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
