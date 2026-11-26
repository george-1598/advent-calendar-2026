import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../lib/auth';

const SLIDES = [
  { emoji: '🚪', title: 'A new door every day', text: 'From December 1 to 25, one door opens each midnight (Bucharest time). Find today’s door: it moves around every day!' },
  { emoji: '🧩', title: 'Solve it for a real gift', text: 'Behind each door is a riddle, puzzle or game. Get it right and you’ll learn where your real-life surprise is hiding. Stuck? Hints unlock as you try.' },
  { emoji: '🔤', title: 'Collect the secret phrase', text: 'Every solved day gives you one badge character. With all 25, unscramble them on Christmas Day to reveal a secret message.' },
  { emoji: '🎨', title: 'Hidden themes', text: 'The calendar can change its look. New themes are hidden inside the calendar itself; keep an eye out for clues.' },
  { emoji: '📲', title: 'Keep it one tap away', text: 'Add the calendar to your home screen so it opens like an app every morning. You can replay this tour anytime from “About”.' },
];

const doneKey = (id: string) => `advent-tour-done-${id}`;
export const TOUR_EVENT = 'advent-open-tour';
/** Open the tour again (from the How to play page). */
export const openTour = () => window.dispatchEvent(new Event(TOUR_EVENT));

/** The first time someone signs in (on a device): a short swipeable introduction. */
export default function Tour() {
  const { session, profile } = useAuth();
  const userId = session?.user.id ?? (profile ? 'dev' : null);
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const startX = useRef<number | null>(null);

  useEffect(() => {
    if (!userId) return;
    let seen = true;
    try {
      seen = localStorage.getItem(doneKey(userId)) === '1';
    } catch {
      // ignore
    }
    if (!seen) setOpen(true);
  }, [userId]);
  useEffect(() => {
    const show = () => {
      setI(0);
      setOpen(true);
    };
    window.addEventListener(TOUR_EVENT, show);
    return () => window.removeEventListener(TOUR_EVENT, show);
  }, []);

  if (!open) return null;
  const finish = () => {
    setOpen(false);
    try {
      if (userId) localStorage.setItem(doneKey(userId), '1');
    } catch {
      // ignore
    }
  };
  const last = i === SLIDES.length - 1;
  const s = SLIDES[i];

  return createPortal(
    <div className="tour" role="dialog" aria-modal="true" aria-label="Welcome">
      <div
        className="tour-card"
        onPointerDown={(e) => (startX.current = e.clientX)}
        onPointerUp={(e) => {
          const dx = startX.current === null ? 0 : e.clientX - startX.current;
          startX.current = null;
          if (dx < -40 && !last) setI(i + 1);
          if (dx > 40 && i > 0) setI(i - 1);
        }}
      >
        <button className="tour-skip" onClick={finish}>
          Skip
        </button>
        <div className="tour-slide" key={i}>
          <span className="tour-emoji">{s.emoji}</span>
          <h2>{s.title}</h2>
          <p>{s.text}</p>
        </div>
        <div className="tour-dots" role="tablist">
          {SLIDES.map((_, k) => (
            <button key={k} role="tab" aria-selected={k === i} aria-label={`Slide ${k + 1}`} onClick={() => setI(k)} />
          ))}
        </div>
        <div className="tour-actions">
          {i > 0 && (
            <button className="tour-back" onClick={() => setI(i - 1)}>
              Back
            </button>
          )}
          <button className="btn-primary tour-next" onClick={() => (last ? finish() : setI(i + 1))}>
            {last ? 'Let’s go 🎄' : 'Next'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
