import { useState } from 'react';
import type { GameProps } from './types';
import { useGameSubmit } from './useSubmit';
import { useProgress } from '../../lib/progress';
import Dial from './Dial';

const MESSAGES: Record<string, string> = {
  close: 'So close! Just a little off.',
  near: 'Getting warm… you’re in the neighbourhood.',
  far: 'Not on the same wavelength yet. Try again!',
};

const parseTarget = (s: string | null | undefined) => {
  if (!s) return null;
  const [c, t] = s.split(',').map(Number);
  return Number.isFinite(c) ? { center: c, tol: Number.isFinite(t) ? t : 7 } : null;
};

/** Set the needle where you think the clue sits between the two ends. */
export default function Wavelength({ day, content, solved, step }: GameProps) {
  const sp = content.spectrum ?? { left: '', right: '', clue: '' };
  const { byDay } = useProgress();
  const [value, setValue] = useState(50);
  const [guess, setGuess] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { busy, error, run } = useGameSubmit(day);
  // The target is known once solved (or given up); not inside a chain step.
  const target = parseTarget(revealed ?? (step === undefined ? byDay[day]?.answer : null));
  const done = solved || Boolean(revealed);

  const lock = async () => {
    const res = await run(String(value));
    if (!res) return;
    setGuess(value);
    if (res.correct) {
      setRevealed((res as unknown as { target?: string }).target ?? null);
      setMessage(null);
    } else {
      setMessage(MESSAGES[(res as unknown as { zone?: string }).zone ?? 'far'] ?? MESSAGES.far);
    }
  };

  return (
    <div className="game wavelength">
      {content.prompt && <p className="day-prompt">{content.prompt}</p>}
      <p className="wavelength-clue">“{sp.clue}”</p>
      <Dial
        value={done && target && guess === null ? target.center : value}
        onChange={done ? undefined : setValue}
        target={done ? target : null}
        ghost={done && guess !== null ? guess : null}
        left={sp.left}
        right={sp.right}
        label={`Where does “${sp.clue}” sit between ${sp.left} and ${sp.right}?`}
      />
      {!done && (
        <>
          <div className="wavelength-nudge">
            <button className="game-secondary" onClick={() => setValue((v) => Math.max(0, v - 1))} aria-label="Move left">
              ◀
            </button>
            <span className="game-help">Drag the needle, or nudge it</span>
            <button className="game-secondary" onClick={() => setValue((v) => Math.min(100, v + 1))} aria-label="Move right">
              ▶
            </button>
          </div>
          <button className="game-primary" onClick={lock} disabled={busy}>
            {busy ? 'Checking…' : 'Lock it in'}
          </button>
        </>
      )}
      {done && target && <p className="wavelength-done">🎯 On the same wavelength! The bands show the secret spot.</p>}
      {message && !done && <p className="form-error">{message}</p>}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
