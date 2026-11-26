import { useState } from 'react';
import type { GameProps } from './types';
import { useGameSubmit } from './useSubmit';

export default function Anagram({ day, content, solved }: GameProps) {
  const [tiles, setTiles] = useState(() => [...(content.letters ?? '').replace(/\s+/g, '').toUpperCase()]);
  const [picked, setPicked] = useState<number[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [wrong, setWrong] = useState(0);
  const { busy, error, run } = useGameSubmit(day);
  const word = picked.map((i) => tiles[i]).join('');

  const shuffle = () => {
    setPicked([]);
    setTiles((t) => [...t].sort(() => Math.random() - 0.5));
  };

  const check = async () => {
    const res = await run(word);
    if (res && !res.correct) {
      setMessage('Not quite — try another arrangement!');
      setWrong((n) => n + 1);
    }
  };

  return (
    <div className="game anagram">
      {content.prompt && <p className="day-prompt">{content.prompt}</p>}
      <div key={wrong} className={wrong ? 'anagram-answer is-wrong' : 'anagram-answer'} aria-live="polite">
        {picked.length === 0 ? (
          <span className="anagram-empty">Tap the letters below</span>
        ) : (
          picked.map((ti, i) => (
            <button key={i} className="anagram-slot" disabled={solved} onClick={() => setPicked((p) => p.filter((_, k) => k !== i))}>
              {tiles[ti]}
            </button>
          ))
        )}
      </div>
      {!solved && (
        <>
          <div className="anagram-tiles">
            {tiles.map((ch, i) => (
              <button
                key={i}
                className="anagram-tile"
                disabled={picked.includes(i)}
                onClick={() => {
                  setPicked((p) => [...p, i]);
                  setMessage(null);
                }}
              >
                {ch}
              </button>
            ))}
          </div>
          <div className="game-row">
            <button className="game-secondary" onClick={shuffle}>⤮ Shuffle</button>
            <button className="game-secondary" onClick={() => setPicked((p) => p.slice(0, -1))} disabled={!picked.length}>
              ⌫ Undo
            </button>
            <button className="game-primary" onClick={check} disabled={busy || !word}>
              {busy ? '…' : 'Check'}
            </button>
          </div>
        </>
      )}
      {message && <p className="form-error">{message}</p>}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
