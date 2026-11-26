import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useCalendars } from '../lib/calendars';
import { useNow } from '../lib/useNow';
import { isUnlocked, TOTAL_DAYS } from '../lib/time';
import { GAME_KINDS } from './games/types';
import { Confetti } from './Finale';

interface WrappedData {
  name: string;
  total: number;
  solved: number;
  revealed: number;
  first_try: number;
  wrong_total: number;
  toughest: { day: number; attempts: number } | null;
  fastest: { day: number; seconds: number } | null;
  night_owl: number;
  favourite_kind: string | null;
  letters: string | null;
  thanks_sent: number;
  hints_received: number;
}

interface Slide {
  bg: string;
  emoji: string;
  kicker: string;
  big: string;
  text: string;
}

function duration(s: number): string {
  if (s < 60) return `${s} second${s === 1 ? '' : 's'}`;
  if (s < 3600) {
    const m = Math.round(s / 60);
    return `${m} minute${m === 1 ? '' : 's'}`;
  }
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return m ? `${h} h ${m} min` : `${h} hours`;
}

function slidesFor(w: WrappedData, from: string | null): Slide[] {
  const done = w.solved + w.revealed;
  const kind = GAME_KINDS.find((k) => k.id === w.favourite_kind)?.label.split(' (')[0];
  const s: Slide[] = [
    { bg: '#7a231c', emoji: '🎁', kicker: `${w.name}’s Christmas 2026`, big: 'Wrapped', text: from ? `Your December with ${from}’s calendar. Tap to continue.` : 'Your December, door by door. Tap to continue.' },
    { bg: '#1e5a3c', emoji: '🚪', kicker: 'Doors opened', big: `${done} / ${w.total || TOTAL_DAYS}`, text: done >= w.total && w.total > 0 ? 'Every single one. Impressive!' : 'Every door counts.' },
  ];
  if (w.first_try > 0) s.push({ bg: '#1d4e9e', emoji: '🎯', kicker: 'Solved on the first try', big: String(w.first_try), text: w.first_try === 1 ? 'Straight to the answer, once.' : 'Straight to the answer, no hesitation.' });
  if (w.fastest) s.push({ bg: '#a0522d', emoji: '⚡', kicker: 'Fastest solve', big: duration(w.fastest.seconds), text: `December ${w.fastest.day}, after it opened.` });
  if (w.toughest) s.push({ bg: '#5b3a8a', emoji: '🧠', kicker: 'The toughest door', big: `December ${w.toughest.day}`, text: `${w.toughest.attempts} wrong ${w.toughest.attempts === 1 ? 'try' : 'tries'} before it gave in.` });
  if (w.night_owl > 0) s.push({ bg: '#0a1430', emoji: '🦉', kicker: 'Night owl', big: String(w.night_owl), text: `${w.night_owl === 1 ? 'door' : 'doors'} opened between midnight and 6 am.` });
  if (kind) s.push({ bg: '#b5651d', emoji: '🎮', kicker: 'Most played', big: kind, text: 'Your favourite kind of puzzle.' });
  s.push({ bg: '#2f4f4f', emoji: '🤝', kicker: 'Kindness', big: `${w.thanks_sent} 💌`, text: `${w.thanks_sent === 1 ? 'thank-you' : 'thank-yous'} sent${w.hints_received ? ` · ${w.hints_received} ${w.hints_received === 1 ? 'hint' : 'hints'} received` : ''}.` });
  if (w.letters) s.push({ bg: '#7a231c', emoji: '🔤', kicker: 'Your letters', big: w.letters, text: 'Every badge you collected, in order.' });
  s.push({ bg: '#1e5a3c', emoji: '🎄', kicker: 'That’s a wrap', big: 'Merry Christmas!', text: `${w.wrong_total} wrong guesses, ${done} surprises. See you next December.` });
  return s;
}

/** From December 25: a story-style recap of the player's December on this calendar. */
export function WrappedBanner() {
  const now = useNow(60000);
  const [open, setOpen] = useState(false);
  if (!isUnlocked(TOTAL_DAYS, now)) return null;
  return (
    <>
      <button className="wrapped-banner" onClick={() => setOpen(true)}>
        <span>🎁</span>
        <span>
          <strong>Your Christmas Wrapped is ready</strong>
          <small>Your December in a few taps</small>
        </span>
      </button>
      {open && <WrappedStory onClose={() => setOpen(false)} />}
    </>
  );
}

function WrappedStory({ onClose }: { onClose: () => void }) {
  const { current, currentId } = useCalendars();
  const [data, setData] = useState<WrappedData | null>(null);
  const [i, setI] = useState(0);
  const startX = useRef<number | null>(null);
  useEffect(() => {
    supabase.rpc('my_wrapped', { p_calendar: currentId }).then(({ data }) => setData(data as WrappedData | null));
  }, [currentId]);
  const slides = data ? slidesFor(data, current.is_main ? null : current.owner_name) : [];
  const last = i >= slides.length - 1;
  const next = () => (last ? onClose() : setI((n) => n + 1));
  const prev = () => setI((n) => Math.max(0, n - 1));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const slide = slides[i];

  return createPortal(
    <div
      className="wrapped"
      role="dialog"
      aria-modal="true"
      aria-label="Christmas Wrapped"
      style={{ background: slide?.bg ?? '#7a231c' }}
      onPointerDown={(e) => (startX.current = e.clientX)}
      onPointerUp={(e) => {
        const dx = startX.current === null ? 0 : e.clientX - startX.current;
        startX.current = null;
        if (Math.abs(dx) > 40) return dx < 0 ? next() : prev();
        // Tap: left third goes back, the rest goes forward.
        if (e.clientX < window.innerWidth / 3) prev();
        else next();
      }}
    >
      <div className="wrapped-bars">
        {slides.map((_, k) => (
          <span key={k} className={k < i ? 'is-done' : k === i ? 'is-current' : ''} />
        ))}
      </div>
      <button className="wrapped-close" onPointerUp={(e) => e.stopPropagation()} onClick={onClose} aria-label="Close">
        ✕
      </button>
      {!data ? (
        <p className="wrapped-loading">Wrapping it up…</p>
      ) : (
        slide && (
          <div className="wrapped-slide" key={i}>
            <span className="wrapped-emoji">{slide.emoji}</span>
            <span className="wrapped-kicker">{slide.kicker}</span>
            <strong className="wrapped-big">{slide.big}</strong>
            <p className="wrapped-text">{slide.text}</p>
          </div>
        )
      )}
      {last && data && <Confetti />}
    </div>,
    document.body,
  );
}
