import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import type { CrackerDesign } from './data';

const SNAP_AT = 120; // px of pull before it bangs

export function Confetti({ count = 28 }: { count?: number }) {
  const colors = ['#FF6B6B', '#FFD166', '#7FD3A0', '#7FB2FF', '#F7A6D8', '#FFFFFF'];
  return (
    <span className="confetti" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
        const d = 60 + Math.random() * 90;
        return (
          <i
            key={i}
            style={
              {
                background: colors[i % colors.length],
                '--dx': `${Math.cos(a) * d}px`,
                '--dy': `${Math.sin(a) * d - 40}px`,
                '--r': `${Math.random() * 720 - 360}deg`,
                animationDelay: `${Math.random() * 0.08}s`,
              } as CSSProperties
            }
          />
        );
      })}
    </span>
  );
}

interface Props {
  design: CrackerDesign;
  pulled: boolean;
  /** Snapping triggered from outside (the pull-all button). */
  bursting: boolean;
  label: string;
  onSnap: () => void;
  onTapPulled: () => void;
}

/**
 * Pull the two ends apart (one finger dragging sideways, or two fingers
 * spreading). It stretches and trembles, then bangs open past SNAP_AT.
 */
export default function Cracker({ design, pulled, bursting, label, onSnap, onTapPulled }: Props) {
  const [pull, setPull] = useState(0);
  const [active, setActive] = useState(false);
  const [snapping, setSnapping] = useState(false);
  const pointers = useRef(new Map<number, number>());
  const start = useRef<{ x: number; gap: number } | null>(null);

  useEffect(() => {
    if (pulled) setSnapping(false);
  }, [pulled]);
  const isSnapping = snapping || bursting;

  const spread = () => {
    const xs = [...pointers.current.values()];
    return xs.length >= 2 ? Math.abs(xs[0] - xs[1]) : 0;
  };

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (pulled || snapping) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, e.clientX);
    start.current = { x: [...pointers.current.values()][0], gap: spread() };
    setActive(true);
  };

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current || !pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, e.clientX);
    const raw =
      pointers.current.size >= 2 ? spread() - start.current.gap : Math.abs(e.clientX - start.current.x);
    if (raw >= SNAP_AT) {
      pointers.current.clear();
      start.current = null;
      setActive(false);
      setSnapping(true);
      onSnap();
      return;
    }
    // Resistance: the cracker gives less the harder you pull.
    setPull(Math.max(0, raw) * 0.32);
  };

  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      if (start.current && pull < 2 && pulled) onTapPulled();
      start.current = null;
      setActive(false);
      setPull(0);
    }
  };

  const tremble = active && pull > 8 ? 'is-trembling' : '';
  const style = {
    '--a': design.a,
    '--b': design.b,
    '--band': design.band,
    '--pull': `${pull}px`,
  } as CSSProperties;

  return (
    <div
      className={['cracker', `cracker--${design.pattern}`, pulled && 'is-pulled', isSnapping && 'is-snapping', active && 'is-active', tremble]
        .filter(Boolean)
        .join(' ')}
      style={style}
      role="button"
      tabIndex={0}
      aria-label={label}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onClick={() => pulled && onTapPulled()}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        if (pulled) onTapPulled();
        else {
          setSnapping(true);
          onSnap();
        }
      }}
    >
      <span className="cr-half cr-half--l">
        <span className="cr-frill" />
        <span className="cr-neck" />
        <span className="cr-body" />
      </span>
      <span className="cr-half cr-half--r">
        <span className="cr-body" />
        <span className="cr-neck" />
        <span className="cr-frill" />
      </span>
      {isSnapping && <Confetti />}
      {pulled && <span className="cr-num">{design.day}</span>}
    </div>
  );
}
