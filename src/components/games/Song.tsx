import { useEffect, useRef, useState } from 'react';
import { playMusicNote } from '../../lib/sound';
import type { GameProps } from './types';
import { useGameSubmit } from './useSubmit';
import TextAnswer from './TextAnswer';
import { parseMelody } from './melody';

/** Plays a melody (ignores the mute switch — pressing play is a clear choice). */
export function useMelodyPlayer() {
  const [playing, setPlaying] = useState(-1);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const play = (melody: string, tempo = 110) => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    const { notes } = parseMelody(melody);
    const beatMs = 60000 / tempo;
    let t = 0;
    notes.forEach((n, i) => {
      timers.current.push(
        window.setTimeout(() => {
          setPlaying(i);
          if (n.midi !== null) playMusicNote(n.midi, 0.14, true);
        }, t),
      );
      t += n.beats * beatMs;
    });
    timers.current.push(window.setTimeout(() => setPlaying(-1), t + 200));
    return notes.length;
  };
  return { play, playing };
}

export default function Song({ day, content, solved }: GameProps) {
  const { busy, error, run } = useGameSubmit(day);
  const { play, playing } = useMelodyPlayer();
  const count = content.melody ? parseMelody(content.melody).notes.length : 0;

  return (
    <div className="game song">
      {content.prompt && <p className="day-prompt">{content.prompt}</p>}
      {content.melody && (
        <div className="song-player">
          <button className="song-play" onClick={() => play(content.melody!, content.tempo)} disabled={playing >= 0}>
            {playing >= 0 ? '♪ Playing…' : '▶ Play the melody'}
          </button>
          <div className="song-bars" aria-hidden="true">
            {Array.from({ length: Math.min(count, 32) }, (_, i) => (
              <span key={i} className={i === playing ? 'is-on' : i < playing ? 'is-past' : ''} style={{ height: `${30 + ((i * 37) % 60)}%` }} />
            ))}
          </div>
        </div>
      )}
      {content.audioUrl && <audio className="song-audio" controls preload="none" src={content.audioUrl} />}
      {!solved && <TextAnswer busy={busy} placeholder="Name the song" onSubmit={async (a) => Boolean((await run(a))?.correct)} />}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
