import { useState } from 'react';
import type { GameProps } from './types';
import { useGameSubmit } from './useSubmit';

/** Each round has three statements; tap the lie. All rounds are checked together. */
export default function Truths({ day, content, solved }: GameProps) {
  const rounds = content.rounds ?? [];
  const [round, setRound] = useState(0);
  const [picks, setPicks] = useState<(number | null)[]>(() => rounds.map(() => null));
  const [message, setMessage] = useState<string | null>(null);
  const { busy, error, run } = useGameSubmit(day);
  const r = rounds[round];
  const last = round === rounds.length - 1;
  const complete = picks.every((p) => p !== null);

  const check = async () => {
    const res = await run(picks.join(','));
    if (res && !res.correct) {
      setMessage(`${res.right} of ${res.total} lies spotted — go back and change some picks.`);
      setRound(0);
    }
  };

  if (!r) return null;
  return (
    <div className="game truths">
      {content.prompt && <p className="day-prompt">{content.prompt}</p>}
      <div className="truths-progress" aria-label={`Round ${round + 1} of ${rounds.length}`}>
        {rounds.map((_, i) => (
          <button key={i} className={['truths-dot', i === round && 'is-current', picks[i] !== null && 'is-picked'].filter(Boolean).join(' ')} onClick={() => setRound(i)} aria-label={`Round ${i + 1}`} />
        ))}
      </div>
      <p className="game-help">
        Round {round + 1} of {rounds.length} · Which one is the lie? 🤥
      </p>
      <div className="truths-list" key={round}>
        {r.statements.map((s, i) => (
          <button
            key={i}
            className={picks[round] === i ? 'truths-card is-picked' : 'truths-card'}
            aria-pressed={picks[round] === i}
            disabled={solved}
            onClick={() => {
              setPicks((p) => p.map((v, k) => (k === round ? i : v)));
              setMessage(null);
              if (!last) window.setTimeout(() => setRound((n) => Math.min(rounds.length - 1, n + 1)), 350);
            }}
          >
            <span className="truths-mark">{picks[round] === i ? '🤥' : '?'}</span>
            <span>{s}</span>
          </button>
        ))}
      </div>
      {!solved && (
        <div className="game-row">
          <button className="game-secondary" onClick={() => setRound((n) => n - 1)} disabled={round === 0}>
            ← Back
          </button>
          {last ? (
            <button className="game-primary" onClick={check} disabled={!complete || busy}>
              {busy ? 'Checking…' : complete ? 'Check my picks' : 'Pick a lie in every round'}
            </button>
          ) : (
            <button className="game-secondary" onClick={() => setRound((n) => n + 1)} disabled={picks[round] === null}>
              Next →
            </button>
          )}
        </div>
      )}
      {message && <p className="form-error">{message}</p>}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
