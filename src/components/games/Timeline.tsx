import { useState } from 'react';
import type { GameProps } from './types';
import { useGameSubmit } from './useSubmit';

export default function Timeline({ day, content, solved }: GameProps) {
  const [order, setOrder] = useState(() => content.items ?? []);
  const [message, setMessage] = useState<string | null>(null);
  const { busy, error, run } = useGameSubmit(day);

  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    setOrder((o) => {
      const n = [...o];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
    setMessage(null);
  };

  const check = async () => {
    const res = await run(order.map((x) => x.id).join(','));
    if (res && !res.correct) setMessage(`${res.right} of ${res.total} in the right place — keep shuffling!`);
  };

  return (
    <div className="game timeline">
      {content.prompt && <p className="day-prompt">{content.prompt}</p>}
      <p className="game-help">Put these in order, from first to last.</p>
      <ol className="timeline-list">
        {order.map((item, i) => (
          <li key={item.id} className="timeline-item">
            <span className="timeline-n">{i + 1}</span>
            <span className="timeline-text">{item.text}</span>
            {!solved && (
              <span className="timeline-moves">
                <button onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move “${item.text}” earlier`}>
                  ↑
                </button>
                <button onClick={() => move(i, 1)} disabled={i === order.length - 1} aria-label={`Move “${item.text}” later`}>
                  ↓
                </button>
              </span>
            )}
          </li>
        ))}
      </ol>
      {!solved && (
        <button className="game-primary" onClick={check} disabled={busy || order.length < 2}>
          {busy ? 'Checking…' : 'This is the order'}
        </button>
      )}
      {message && <p className="form-error">{message}</p>}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
