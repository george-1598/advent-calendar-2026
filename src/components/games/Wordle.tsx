import { useCallback, useEffect, useState } from 'react';
import type { GameProps } from './types';
import { useGameSubmit } from './useSubmit';

const ROWS = 6;
const KEYS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
type Row = { word: string; pattern: string };

export default function Wordle({ day, content, solved }: GameProps) {
  const length = Math.max(2, Math.min(10, content.length ?? 5));
  const storeKey = `advent-wordle-${day}`;
  const [rows, setRows] = useState<Row[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(storeKey) ?? '[]') as Row[];
    } catch {
      return [];
    }
  });
  const [current, setCurrent] = useState('');
  const [shake, setShake] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const { busy, error, run } = useGameSubmit(day);

  useEffect(() => {
    try {
      localStorage.setItem(storeKey, JSON.stringify(rows));
    } catch {
      // ignore
    }
  }, [rows, storeKey]);

  const won = solved || rows.some((r) => /^g+$/.test(r.pattern));
  const out = !won && rows.length >= ROWS;

  const press = useCallback(
    async (key: string) => {
      if (won || out || busy) return;
      if (key === 'ENTER') {
        if (current.length !== length) {
          setShake((n) => n + 1);
          setMessage(`The word has ${length} letters`);
          return;
        }
        setMessage(null);
        const res = await run(current);
        if (!res) return;
        setRows((r) => [...r, { word: current, pattern: res.pattern ?? 'b'.repeat(length) }]);
        setCurrent('');
        if (!res.correct && rows.length + 1 >= ROWS) setMessage('Out of tries — start a fresh board and try again!');
        return;
      }
      if (key === 'BACK') return setCurrent((c) => c.slice(0, -1));
      if (/^[A-Z]$/.test(key) && current.length < length) setCurrent((c) => c + key);
    },
    [won, out, busy, current, length, run, rows.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Enter') void press('ENTER');
      else if (e.key === 'Backspace') void press('BACK');
      else if (/^[a-zA-Z]$/.test(e.key)) void press(e.key.toUpperCase());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press]);

  // Best known state per letter for the keyboard colours.
  const keyState: Record<string, string> = {};
  const rank = { g: 3, y: 2, b: 1 } as Record<string, number>;
  rows.forEach((r) =>
    [...r.word].forEach((ch, i) => {
      const s = r.pattern[i];
      if (!keyState[ch] || rank[s] > rank[keyState[ch]]) keyState[ch] = s;
    }),
  );

  const grid = Array.from({ length: ROWS }, (_, i) => rows[i] ?? (i === rows.length ? { word: current, pattern: '' } : { word: '', pattern: '' }));

  return (
    <div className="game wordle" style={{ ['--len' as string]: length }}>
      {content.prompt && <p className="day-prompt">{content.prompt}</p>}
      <div className="wordle-grid" role="grid" aria-label="Wordle board">
        {grid.map((r, ri) => (
          <div key={ri} className={ri === rows.length && shake ? 'wordle-row is-shaking' : 'wordle-row'} role="row" data-shake={shake}>
            {Array.from({ length }, (_, ci) => {
              const ch = r.word[ci] ?? '';
              const s = r.pattern[ci];
              return (
                <span
                  key={ci}
                  role="gridcell"
                  className={['wordle-tile', s && `is-${s}`, ch && !s && 'is-typed'].filter(Boolean).join(' ')}
                  style={{ animationDelay: s ? `${ci * 0.12}s` : undefined }}
                >
                  {ch}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      {message && <p className="form-error">{message}</p>}
      {error && <p className="form-error">{error}</p>}
      {out && (
        <button className="game-secondary" onClick={() => { setRows([]); setMessage(null); }}>
          Start a fresh board
        </button>
      )}
      {!won && !out && (
        <div className="wordle-keys">
          {KEYS.map((row, i) => (
            <div key={row} className="wordle-keyrow">
              {i === 2 && (
                <button className="wordle-key is-wide" onClick={() => void press('ENTER')} disabled={busy}>
                  Enter
                </button>
              )}
              {[...row].map((k) => (
                <button key={k} className={`wordle-key ${keyState[k] ? `is-${keyState[k]}` : ''}`} onClick={() => void press(k)}>
                  {k}
                </button>
              ))}
              {i === 2 && (
                <button className="wordle-key is-wide" onClick={() => void press('BACK')} aria-label="Backspace">
                  ⌫
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
