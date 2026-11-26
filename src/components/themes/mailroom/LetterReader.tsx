import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { NUMBER_WORDS } from '../../../lib/random';
import { playPaperSlide, playTear } from '../../../lib/sound';
import { formatCountdown, unlockAt } from '../../../lib/time';
import type { DayState } from '../../calendar/controller';
import type { Mail } from './data';

type Phase = 'sealed' | 'torn' | 'reading';

interface Props {
  mail: Mail;
  to: string;
  state: DayState | null;
  now: number;
  onQuest: () => void;
  onClose: () => void;
}

/** Tear the strip off the top, the letter slides out and unfolds. */
export default function LetterReader({ mail, to, state, now, onQuest, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>(mail.kind === 'postcard' ? 'reading' : 'sealed');
  const [tear, setTear] = useState(0);
  const tearStart = useRef<number | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Mount-only: lock scrolling and clear pending timers on unmount. (Kept apart
  // from the effect above, which re-runs whenever the parent re-renders.)
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const all = timers.current;
    return () => {
      document.body.style.overflow = overflow;
      all.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  const finishTear = () => {
    if (phase !== 'sealed') return;
    setTear(1);
    playTear();
    setPhase('torn');
    timers.current.push(window.setTimeout(playPaperSlide, 350));
    timers.current.push(window.setTimeout(() => setPhase('reading'), 900));
  };

  const onStripMove = (e: PointerEvent) => {
    if (tearStart.current === null) return;
    const rect = stripRef.current!.getBoundingClientRect();
    const progress = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setTear((t) => Math.max(t, progress));
    if (progress > 0.75) finishTear();
  };

  const word = mail.day ? NUMBER_WORDS[mail.day].toLowerCase() : '';
  let body: ReactNode;
  if (mail.kind === 'postcard' || !mail.day || !state) {
    body = <p className="lr-note">{mail.note}</p>;
  } else {
    body = (
      <>
        <p className="lr-note">
          {`My dearest ${to},\n\nThis is advent letter number ${word}.\n`}
          {state.canOpen
            ? state.pending
              ? 'This letter is still being written… check back soon.'
              : 'Tucked inside is today’s little adventure…'
            : `It’s postmarked for the ${mail.day}th — come back in ${formatCountdown(unlockAt(mail.day) - now)}.`}
          {'\n\nWith all my love ♥'}
        </p>
        <span className="lr-number">{mail.day}</span>
        {state.canOpen && (
          <button className="lr-btn" onClick={onQuest}>
            {state.solved ? 'Read it again' : 'Open December ' + mail.day}
          </button>
        )}
      </>
    );
  }

  return (
    <div className={`lr lr--${phase}`} onClick={onClose}>
      <div className="lr-stage" onClick={(e) => e.stopPropagation()}>
        {mail.kind !== 'postcard' && (
          <div className="lr-envelope" style={{ '--paper': mail.paper } as CSSProperties}>
            <div className="lr-letter-peek" />
            <div className="lr-env-front" />
            <div
              ref={stripRef}
              className="lr-strip"
              style={{ '--tear': tear } as CSSProperties}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                tearStart.current = e.clientX;
              }}
              onPointerMove={onStripMove}
              onPointerUp={() => {
                tearStart.current = null;
                if (tear < 0.05) finishTear(); // a tap tears it too
              }}
            >
              <span className="lr-strip-torn" />
              <span className="lr-strip-label">✂ tear here</span>
            </div>
          </div>
        )}
        <div className={`lr-letter lr-letter--${mail.kind}`} style={{ '--ink': mail.ink } as CSSProperties}>
          {body}
        </div>
      </div>
      <button className="lr-close" onClick={onClose}>
        {phase === 'sealed' ? 'Put it back' : 'Back to the desk'}
      </button>
      {phase === 'sealed' && <p className="lr-hint">Swipe across the top to tear it open</p>}
    </div>
  );
}
