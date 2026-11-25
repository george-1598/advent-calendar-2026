import { useEffect, useRef } from 'react';
import type { TileColor } from '../data/layout';

interface Props {
  day: number;
  color: TileColor;
  onClose: () => void;
}

export default function DayModal({ day, color, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`modal-head tile--${color}`}>
          <span className="modal-kicker">December</span>
          <span className="modal-day">{day}</span>
          <button ref={closeRef} className="modal-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <h2 id="day-title">Day {day}’s quest</h2>
          <p>
            A riddle, puzzle or mini-game will appear here. Solve it to unlock today’s gift and
            collect a badge.
          </p>
          <form className="answer" onSubmit={(e) => e.preventDefault()}>
            <input disabled placeholder="Your answer" aria-label="Your answer" />
            <button disabled>Unlock</button>
          </form>
          <p className="modal-note">Quests are coming soon.</p>
        </div>
      </div>
    </div>
  );
}
