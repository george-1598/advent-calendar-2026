import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { NUMBER_WORDS } from '../../../lib/random';
import { playBookSlide, playPageFlip } from '../../../lib/sound';
import { formatCountdown, unlockAt } from '../../../lib/time';
import type { DayState } from '../../calendar/controller';
import { Flourish, MotifArt } from './art';
import type { BookSpec } from './data';

type Phase = 'start' | 'lift' | 'front' | 'open' | 'closing';

interface Props {
  book: BookSpec;
  from: DOMRect;
  state: DayState | null;
  now: number;
  onQuest: () => void;
  onClose: () => void;
  /** A note about the theme's hidden key, shown on the last page. */
  keyNote?: string | null;
}

/**
 * The pulled-out book: flies from its spot on the shelf to the centre (spine
 * first), turns to show its cover, opens, and lets you flip through the pages.
 */
export default function BookReader({ book, from, state, now, onQuest, onClose, keyNote }: Props) {
  const bookRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>('start');
  const [flipped, setFlipped] = useState(0);
  const [start, setStart] = useState<CSSProperties>({});
  const timers = useRef<number[]>([]);

  // Book size: two pages side by side must fit the screen.
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const bw = Math.min(250, (vw - 28) / 2, (vh * 0.62) / 1.45);
  const bh = bw * 1.45;
  // A book lying flat has its spine along the width of its rectangle.
  const flat = book.orientation === 'flat';
  const spineLength = flat ? from.width : from.height;
  const spineThickness = flat ? from.height : from.width;
  const scale = spineLength / bh;
  const bt = Math.max(10, spineThickness / scale); // spine thickness at full size

  useLayoutEffect(() => {
    // Map the spine (just left of the hinge) onto the book's spot on the shelf.
    const el = bookRef.current!;
    const r = el.getBoundingClientRect();
    const originX = r.left;
    const originY = r.top + bh / 2;
    const cx = from.left + from.width / 2;
    const cy = from.top + from.height / 2;
    if (flat) {
      // Rotated -90° about the hinge, the spine centre sits below the origin.
      const tx = cx - originX;
      const ty = cy - originY - (scale * bt) / 2;
      setStart({ transform: `translate(${tx}px, ${ty}px) rotate(-90deg) scale(${scale}) rotateY(90deg)` });
    } else {
      const tx = cx - originX - scale * (-bt / 2);
      const ty = cy - originY;
      setStart({ transform: `translate(${tx}px, ${ty}px) rotate(0deg) scale(${scale}) rotateY(90deg)` });
    }
    const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));
    later(() => setPhase('lift'), 40);
    later(() => setPhase('front'), 640);
    later(() => {
      setPhase('open');
      setFlipped(1);
      playPageFlip();
    }, 1180);
    const all = timers.current;
    return () => all.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => {
    if (phase === 'closing') return;
    playBookSlide();
    setPhase('closing');
    timers.current.push(window.setTimeout(onClose, 260));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  });

  const style = {
    '--bw': `${bw}px`,
    '--bh': `${bh}px`,
    '--bt': `${bt}px`,
    '--cover': book.color,
    '--ink': book.ink,
    ...(phase === 'start' ? start : {}),
  } as CSSProperties;

  const word = book.day ? NUMBER_WORDS[book.day] : '';
  const leaves: { front: ReactNode; back: ReactNode }[] = [
    {
      front: (
        <div className="bk-cover">
          <div className="bk-cover-frame">
            <span className="bk-cover-title">{book.title}</span>
            <span className="bk-cover-art">
              <MotifArt motif={book.motif === 'none' ? 'star' : book.motif} color={book.ink} />
            </span>
            <span className="bk-cover-small">Christmas MMXXVI</span>
          </div>
        </div>
      ),
      back: <div className="bk-endpaper" />,
    },
    {
      front: (
        <div className="bk-page bk-title-page">
          {book.day ? (
            <>
              <span className="bk-kicker">Chapter</span>
              <span className="bk-big">{word}</span>
              <Flourish color="#8a5a2b" />
              <span className="bk-date">December {book.day}, 2026</span>
            </>
          ) : (
            <>
              <span className="bk-kicker">{book.title}</span>
              <Flourish color="#8a5a2b" />
              <span className="bk-date">A book of small joys</span>
            </>
          )}
        </div>
      ),
      back: (
        <div className="bk-page bk-illustration">
          <MotifArt motif={book.motif === 'none' ? 'tree' : book.motif} color="#9c3b2a" />
        </div>
      ),
    },
    {
      front: (
        <div className="bk-page bk-quote">
          <p>“{book.quote}”</p>
        </div>
      ),
      back: (
        <div className="bk-page bk-ornament">
          <Flourish color="#8a5a2b" />
        </div>
      ),
    },
  ];

  const next = () => {
    if (phase !== 'open' || flipped >= leaves.length) return;
    playPageFlip();
    setFlipped(flipped + 1);
  };
  const prev = () => {
    if (phase !== 'open' || flipped <= 1) return;
    playPageFlip();
    setFlipped(flipped - 1);
  };
  const atEnd = flipped === leaves.length;

  let finalPage: ReactNode;
  if (!book.day || !state) {
    finalPage = (
      <>
        <span className="bk-kicker">The End</span>
        <p>A lovely read, but not one of the advent books. Try another!</p>
      </>
    );
  } else if (state.canOpen) {
    finalPage = (
      <>
        <span className="bk-kicker">December {book.day}</span>
        <p>{state.solved ? 'You already solved this chapter.' : 'Your quest is written on the next page…'}</p>
        <button
          className="bk-quest-btn"
          onClick={(e) => {
            e.stopPropagation();
            onQuest();
          }}
        >
          {state.solved ? 'Read it again' : 'Read the quest'}
        </button>
      </>
    );
  } else {
    finalPage = (
      <>
        <span className="bk-kicker">December {book.day}</span>
        <p>This chapter isn’t written yet. It opens in {formatCountdown(unlockAt(book.day) - now)}.</p>
      </>
    );
  }

  return (
    <div className={`reader reader--${phase}`} onClick={close}>
      <div className="reader-stage">
        <div
          ref={bookRef}
          className={`rb rb--${phase}`}
          style={style}
          onClick={(e) => {
            e.stopPropagation();
            if (phase !== 'open') return;
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            // The hinge sits at the left edge of .rb when open; left of it = left page.
            if (e.clientX < rect.left) prev();
            else next();
          }}
        >
          <div className="rb-spine">
            <span className="rb-spine-title">{book.title}</span>
          </div>
          <div className="rb-block" />
          <div className="rb-final bk-page bk-final">
            {keyNote && <p className="bk-key-note">{keyNote}</p>}
            {finalPage}
          </div>
          {leaves.map((leaf, i) => {
            const isFlipped = i < flipped;
            return (
              <div
                key={i}
                className={isFlipped ? 'rb-leaf is-flipped' : 'rb-leaf'}
                style={{
                  transform: isFlipped
                    ? `rotateY(-180deg) translateZ(${-(i + 1) * 0.6}px)`
                    : `translateZ(${(leaves.length - i) * 0.6}px)`,
                }}
              >
                <div className="rb-face rb-front">{leaf.front}</div>
                <div className="rb-face rb-back">{leaf.back}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="reader-bar" onClick={(e) => e.stopPropagation()}>
        <button className="reader-btn" onClick={prev} disabled={flipped <= 1} aria-label="Previous page">
          ‹
        </button>
        <span className="reader-hint">{atEnd ? 'The last page' : 'Tap the page to turn it'}</span>
        <button className="reader-btn" onClick={next} disabled={atEnd} aria-label="Next page">
          ›
        </button>
        <button className="reader-close" onClick={close}>
          Put it back
        </button>
      </div>
    </div>
  );
}
