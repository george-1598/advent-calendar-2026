import { useState } from 'react';
import type { GameProps } from './types';
import { useGameSubmit } from './useSubmit';
import { statementText, type Suspect } from './suspectsLogic';

const COLORS = ['#c8102e', '#1d4e9e', '#1e7a46', '#b5651d'];
const FACES = ['⛄', '🕵️‍♀️', '🧑‍🎄', '👩🏻'];

/** Four statements, exactly one true: who did it? */
export default function Suspects({ day, content, solved }: GameProps) {
  const suspects = (content.suspects ?? []) as Suspect[];
  const [picked, setPicked] = useState<number | null>(null);
  const [wrong, setWrong] = useState<number[]>([]);
  const [marks, setMarks] = useState<Record<number, 'true' | 'false'>>({});
  const [message, setMessage] = useState<string | null>(null);
  const { busy, error, run } = useGameSubmit(day);

  const accuse = async () => {
    if (picked === null) return;
    const res = await run(String(picked));
    if (res && !res.correct) {
      setWrong((w) => [...w, picked]);
      setMessage(`It wasn’t ${suspects[picked].name}. Think again!`);
      setPicked(null);
    }
  };
  const cycle = (i: number) =>
    setMarks((m) => {
      const next = { ...m };
      if (!m[i]) next[i] = 'true';
      else if (m[i] === 'true') next[i] = 'false';
      else delete next[i];
      return next;
    });

  return (
    <div className="game suspects">
      {content.prompt && <p className="day-prompt">{content.prompt}</p>}
      <p className="suspects-rule">🔎 Exactly <strong>one</strong> of them is telling the truth. Who did it?</p>
      <div className="suspects-grid">
        {suspects.map((s, i) => {
          const out = wrong.includes(i);
          return (
            <div key={i} className={['suspect', picked === i && 'is-picked', out && 'is-out'].filter(Boolean).join(' ')} style={{ '--c': COLORS[i % 4] } as React.CSSProperties}>
              <button className="suspect-pick" onClick={() => !solved && !out && setPicked(picked === i ? null : i)} disabled={solved || out} aria-pressed={picked === i}>
                <span className="suspect-face">{FACES[i % 4]}</span>
                <strong>{s.name}</strong>
              </button>
              <p className="suspect-says">“{statementText(suspects, i)}”</p>
              <button className={`suspect-mark is-${marks[i] ?? 'none'}`} onClick={() => cycle(i)} aria-label={`Mark ${s.name}'s statement`}>
                {marks[i] === 'true' ? '✓ true' : marks[i] === 'false' ? '✗ false' : 'mark'}
              </button>
            </div>
          );
        })}
      </div>
      {!solved && (
        <button className="game-primary" onClick={accuse} disabled={picked === null || busy}>
          {busy ? 'Checking…' : picked === null ? 'Tap the suspect you accuse' : `Accuse ${suspects[picked].name}`}
        </button>
      )}
      {message && !solved && <p className="form-error">{message}</p>}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
