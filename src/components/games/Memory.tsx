import { useEffect, useMemo, useState } from 'react';
import { MEMORY_DONE, type GameProps } from './types';
import { useGameSubmit } from './useSubmit';
import QuestImage from './QuestImage';

/** Flip cards to find pairs of photos; matching every pair solves the day. */
export default function Memory({ day, content, solved }: GameProps) {
  const images = content.images ?? [];
  const deck = useMemo(
    () => [...images, ...images].map((path, i) => ({ id: i, path })).sort(() => Math.random() - 0.5),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [images.join('|')],
  );
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [moves, setMoves] = useState(0);
  const { error, run } = useGameSubmit(day);
  const done = solved || (images.length > 0 && matched.size === images.length);

  useEffect(() => {
    if (open.length !== 2) return;
    const [a, b] = open.map((i) => deck[i]);
    const t = window.setTimeout(
      () => {
        if (a.path === b.path) setMatched((m) => new Set(m).add(a.path));
        setOpen([]);
      },
      a.path === b.path ? 350 : 900,
    );
    return () => window.clearTimeout(t);
  }, [open, deck]);

  useEffect(() => {
    if (!solved && images.length > 0 && matched.size === images.length) void run(MEMORY_DONE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matched.size]);

  const flip = (i: number) => {
    if (done || open.length === 2 || open.includes(i) || matched.has(deck[i].path)) return;
    setOpen((o) => [...o, i]);
    if (open.length === 1) setMoves((m) => m + 1);
  };

  const cols = deck.length <= 6 || deck.length === 9 ? 3 : 4;
  return (
    <div className="game memory">
      {content.prompt && <p className="day-prompt">{content.prompt}</p>}
      <p className="game-help">
        {done ? `All pairs found in ${moves} moves!` : `Find the ${images.length} pairs · ${moves} moves`}
      </p>
      <div className="memory-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {deck.map((card, i) => {
          const faceUp = solved || open.includes(i) || matched.has(card.path);
          return (
            <button key={card.id} className={faceUp ? 'memory-card is-up' : 'memory-card'} onClick={() => flip(i)} aria-label={faceUp ? 'Photo' : 'Hidden card'}>
              <span className="memory-inner">
                <span className="memory-back">❄</span>
                <span className="memory-front">
                  <QuestImage path={card.path} className="memory-img" />
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
