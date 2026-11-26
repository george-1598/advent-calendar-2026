import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useCalendars } from '../lib/calendars';
import { useProgress } from '../lib/progress';
import { playChime } from '../lib/sound';
import { Confetti } from './Finale';

export interface BadgeGameState {
  has_phrase: boolean;
  layout?: number[];
  tiles?: { day: number; char: string }[];
  complete?: boolean;
  attempts?: number;
  solved_at?: string | null;
  answer?: string[] | null;
  phrase?: string | null;
  message?: string | null;
  from?: string | null;
}

/** The badge game for the current calendar (re-checked as days get solved). */
export function useBadgeGame(): [BadgeGameState | null, (s: BadgeGameState) => void] {
  const { currentId } = useCalendars();
  const { solvedCount, ready } = useProgress();
  const [state, setState] = useState<BadgeGameState | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabase.rpc('get_badge_game', { p_calendar: currentId }).then(({ data, error }) => {
      if (!cancelled) setState(error ? null : (data as BadgeGameState | null));
    });
    return () => {
      cancelled = true;
    };
  }, [currentId, solvedCount, ready]);
  return [state, setState];
}

/** Banner on the calendar/badges page: play the game once all 25 are in, or reread the finale. */
export function BadgeGameBanner({ game, onUpdate }: { game: BadgeGameState; onUpdate: (s: BadgeGameState) => void }) {
  const [open, setOpen] = useState(false);
  if (!game.has_phrase || !game.complete) return null;
  const solved = Boolean(game.solved_at);
  return (
    <>
      <button className={solved ? 'finale-banner' : 'finale-banner finale-banner--game'} onClick={() => setOpen(true)}>
        <span>{solved ? '🎉' : '🧩'}</span>
        <span>
          <strong>{solved ? 'You cracked the badge phrase!' : 'All 25 badges collected!'}</strong>
          <small>{solved ? 'Tap to read your finale again' : 'Unscramble them to reveal the secret phrase'}</small>
        </span>
      </button>
      {open && <BadgeGameModal game={game} onUpdate={onUpdate} onClose={() => setOpen(false)} />}
    </>
  );
}

function groups<T>(items: T[], layout: number[]): T[][] {
  let i = 0;
  return layout.map((n) => {
    const g = items.slice(i, i + n);
    i += n;
    return g;
  });
}

function BadgeGameModal({ game, onUpdate, onClose }: { game: BadgeGameState; onUpdate: (s: BadgeGameState) => void; onClose: () => void }) {
  const { currentId } = useCalendars();
  const layout = game.layout ?? [25];
  const tiles = game.tiles ?? [];
  const [order, setOrder] = useState(() => tiles.map((_, i) => i)); // pool order (shuffle-able)
  const [slots, setSlots] = useState<(number | null)[]>(() => Array(25).fill(null)); // tile index per slot
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const solved = Boolean(game.solved_at);
  const placed = useMemo(() => new Set(slots.filter((s): s is number => s !== null)), [slots]);
  const full = slots.every((s) => s !== null);

  useEffect(() => {
    if (solved) playChime();
  }, [solved]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const put = (tile: number) => {
    const at = slots.indexOf(null);
    if (at < 0) return;
    setSlots((s) => s.map((v, i) => (i === at ? tile : v)));
    setFeedback(null);
  };
  const take = (slot: number) => {
    setSlots((s) => s.map((v, i) => (i === slot ? null : v)));
    setFeedback(null);
  };
  const shuffle = () => setOrder((o) => [...o].sort(() => Math.random() - 0.5));
  const check = async () => {
    setBusy(true);
    setError(null);
    const guess = slots.map((s) => (s === null ? '' : tiles[s].char));
    const { data, error } = await supabase.rpc('solve_badge_game', { p_calendar: currentId, p_guess: guess });
    setBusy(false);
    if (error) return setError(error.message);
    const res = data as BadgeGameState & { correct: boolean; right?: number };
    if (!res.correct) return setFeedback(`${res.right} of 25 in the right place. Keep going!`);
    onUpdate(res);
  };

  const slotGroups = groups(slots.map((s, i) => ({ s, i })), layout);

  return createPortal(
    <div className="finale" role="dialog" aria-modal="true" aria-label="Badge phrase" onClick={onClose}>
      {solved && <Confetti />}
      <div className="finale-card badge-game" onClick={(e) => e.stopPropagation()}>
        {solved ? (
          <>
            <span className="finale-kicker">The secret phrase</span>
            <div className="bg-words">
              {groups(game.answer ?? [], layout).map((w, k) => (
                <span key={k} className="bg-word">
                  {w.map((c, i) => (
                    <span key={i} className="bg-slot is-solved" style={{ animationDelay: `${(k * 4 + i) * 40}ms` }}>
                      {c}
                    </span>
                  ))}
                </span>
              ))}
            </div>
            {game.phrase && <p className="bg-phrase">“{game.phrase}”</p>}
            <div className="finale-message is-in">
              {game.message && <p>{game.message}</p>}
              {game.from && <span className="finale-from">— {game.from}</span>}
            </div>
            <button className="btn-primary finale-close" onClick={onClose}>
              Close
            </button>
          </>
        ) : (
          <>
            <span className="finale-kicker">Unscramble your badges</span>
            <p className="bg-help">Tap the badges to place them. Each group is one word.</p>
            <div className="bg-words">
              {slotGroups.map((w, k) => (
                <span key={k} className="bg-word">
                  {w.map(({ s, i }) => (
                    <button key={i} className={s === null ? 'bg-slot' : 'bg-slot is-filled'} onClick={() => s !== null && take(i)} aria-label={s === null ? 'Empty' : `Remove ${tiles[s].char}`}>
                      {s === null ? '' : tiles[s].char}
                    </button>
                  ))}
                </span>
              ))}
            </div>
            <div className="bg-pool">
              {order.map((t) => (
                <button key={t} className="bg-tile" disabled={placed.has(t)} onClick={() => put(t)}>
                  {tiles[t].char}
                </button>
              ))}
            </div>
            {feedback && <p className="bg-feedback">{feedback}</p>}
            {error && <p className="form-error">{error}</p>}
            <div className="game-row">
              <button className="game-secondary" onClick={shuffle}>
                Shuffle
              </button>
              <button className="game-secondary" onClick={() => setSlots(Array(25).fill(null))} disabled={placed.size === 0}>
                Clear
              </button>
              <button className="game-primary" onClick={check} disabled={!full || busy}>
                {busy ? 'Checking…' : 'Check'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Badges page: progress toward the game. */
export function BadgeGameProgress({ game }: { game: BadgeGameState }) {
  if (!game.has_phrase || game.complete) return null;
  const n = game.tiles?.length ?? 0;
  return (
    <p className="bg-progress">
      ⭐ {n} of 25 badges collected. Collect them all: something special happens at the end ✨
    </p>
  );
}
