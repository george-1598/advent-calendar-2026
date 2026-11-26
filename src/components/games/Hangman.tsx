import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { GameProps } from './types';
import { useGameSubmit } from './useSubmit';

const LIVES = 6;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function Snowman({ lost }: { lost: number }) {
  // Pieces melt away in this order: hat, nose, arms, buttons, head, body.
  const show = (i: number) => lost < LIVES - i;
  return (
    <svg className={lost >= LIVES ? 'snowman is-melted' : 'snowman'} viewBox="0 0 120 150" aria-label={`${LIVES - lost} lives left`}>
      <ellipse cx="60" cy="142" rx="50" ry="6" fill="#dfe8f2" />
      {show(5) && <circle cx="60" cy="112" r="30" fill="#fff" stroke="#d6e0ea" strokeWidth="2" />}
      {show(4) && <circle cx="60" cy="62" r="22" fill="#fff" stroke="#d6e0ea" strokeWidth="2" />}
      {show(3) && (
        <g fill="#2b2b2b">
          <circle cx="60" cy="100" r="3" />
          <circle cx="60" cy="112" r="3" />
          <circle cx="60" cy="124" r="3" />
          <circle cx="53" cy="57" r="2.5" />
          <circle cx="67" cy="57" r="2.5" />
        </g>
      )}
      {show(2) && <path d="M32 100 L10 84 M88 100 L110 84 M14 87 l-6 -2 M106 87 l6 -2" stroke="#6b4423" strokeWidth="3" strokeLinecap="round" />}
      {show(1) && <path d="M60 63 l18 4 -18 4 Z" fill="#f08a3c" />}
      {show(0) && (
        <g>
          <rect x="40" y="38" width="40" height="5" fill="#c8102e" />
          <rect x="46" y="16" width="28" height="24" fill="#2b2b2b" />
        </g>
      )}
    </svg>
  );
}

export default function Hangman({ day, content, solved, step }: GameProps) {
  const mask = (content.mask ?? '').toUpperCase();
  const storeKey = `advent-hangman-${day}-${step ?? 0}`;
  const [state, setState] = useState<{ revealed: Record<number, string>; guessed: string[]; lost: number }>(() => {
    try {
      return JSON.parse(localStorage.getItem(storeKey) ?? '') as { revealed: Record<number, string>; guessed: string[]; lost: number };
    } catch {
      return { revealed: {}, guessed: [], lost: 0 };
    }
  });
  const [checking, setChecking] = useState<string | null>(null);
  const { error, run } = useGameSubmit(day);

  useEffect(() => {
    try {
      localStorage.setItem(storeKey, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [state, storeKey]);

  const slots = [...mask];
  const complete = slots.every((c, i) => c === ' ' || state.revealed[i]);
  const word = slots.map((c, i) => (c === ' ' ? ' ' : state.revealed[i] ?? '')).join('');
  const melted = state.lost >= LIVES;

  useEffect(() => {
    if (complete && !solved && slots.length) void run(word);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete]);

  const guess = async (letter: string) => {
    if (solved || melted || checking || state.guessed.includes(letter)) return;
    setChecking(letter);
    const { data, error: err } = await supabase.rpc('hangman_letter', { p_day: day, p_letter: letter, p_step: step ?? null });
    setChecking(null);
    if (err) return;
    const positions = (data as number[]) ?? [];
    setState((s) => ({
      guessed: [...s.guessed, letter],
      lost: positions.length ? s.lost : s.lost + 1,
      revealed: { ...s.revealed, ...Object.fromEntries(positions.map((p) => [p, letter])) },
    }));
  };

  return (
    <div className="game hangman">
      {content.prompt && <p className="day-prompt">{content.prompt}</p>}
      <Snowman lost={solved ? 0 : state.lost} />
      <div className="hangman-word" aria-label="The word">
        {slots.map((c, i) =>
          c === ' ' ? <span key={i} className="hangman-gap" /> : <span key={i} className="hangman-slot">{solved ? '★' : state.revealed[i] ?? ''}</span>,
        )}
      </div>
      {melted && !solved ? (
        <>
          <p className="form-error">The snowman melted! ☀️ Build a new one and try again.</p>
          <button className="game-secondary" onClick={() => setState({ revealed: {}, guessed: [], lost: 0 })}>
            ⛄ Build a new snowman
          </button>
        </>
      ) : (
        !solved && (
          <>
            <p className="game-help">{LIVES - state.lost} snowman pieces left</p>
            <div className="hangman-keys">
              {ALPHABET.map((l) => {
                const used = state.guessed.includes(l);
                const hit = used && Object.values(state.revealed).includes(l);
                return (
                  <button key={l} className={['wordle-key', used && (hit ? 'is-g' : 'is-b')].filter(Boolean).join(' ')} disabled={used || !!checking} onClick={() => void guess(l)}>
                    {checking === l ? '…' : l}
                  </button>
                );
              })}
            </div>
          </>
        )
      )}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
