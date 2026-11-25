import type { Motif } from './data';

/** Small gold-stamped motifs for spines, covers and pages. */
export function MotifArt({ motif, color }: { motif: Motif; color: string }) {
  switch (motif) {
    case 'holly':
      return (
        <svg viewBox="0 0 40 40" aria-hidden="true">
          <path d="M20 20 C 12 10, 4 16, 6 8 C 12 12, 16 6, 20 20 Z" fill={color} />
          <path d="M20 20 C 28 10, 36 16, 34 8 C 28 12, 24 6, 20 20 Z" fill={color} />
          <circle cx="17" cy="23" r="3" fill={color} />
          <circle cx="23" cy="23" r="3" fill={color} />
          <circle cx="20" cy="27" r="3" fill={color} />
        </svg>
      );
    case 'tree':
      return (
        <svg viewBox="0 0 40 40" aria-hidden="true">
          <path d="M20 3 L30 18 H25 L33 30 H7 L15 18 H10 Z" fill={color} />
          <rect x="18" y="30" width="4" height="6" fill={color} />
        </svg>
      );
    case 'star':
      return (
        <svg viewBox="0 0 40 40" aria-hidden="true">
          <path d="M20 3 l5 11 12 1 -9 8 3 12 -11 -6 -11 6 3 -12 -9 -8 12 -1 Z" fill={color} />
        </svg>
      );
    case 'candle':
      return (
        <svg viewBox="0 0 40 40" aria-hidden="true">
          <path d="M20 4 C 24 10, 22 14, 20 14 C 18 14, 16 10, 20 4 Z" fill={color} />
          <rect x="16" y="16" width="8" height="18" fill={color} />
          <rect x="11" y="34" width="18" height="3" fill={color} />
        </svg>
      );
    case 'bird':
      return (
        <svg viewBox="0 0 40 40" aria-hidden="true">
          <path d="M8 24 C 10 14, 22 10, 28 16 L 35 14 L 30 20 C 30 28, 20 32, 12 30 L 5 33 Z" fill={color} />
          <circle cx="25" cy="17" r="1.4" fill="#000" opacity="0.5" />
        </svg>
      );
    case 'none':
      return null;
  }
}

/** Ornamental gold flourish for title pages. */
export function Flourish({ color }: { color: string }) {
  return (
    <svg className="bk-flourish" viewBox="0 0 120 16" aria-hidden="true">
      <path
        d="M2 8 C 20 8, 30 2, 44 6 C 52 8, 54 12, 60 8 C 66 12, 68 8, 76 6 C 90 2, 100 8, 118 8"
        stroke={color}
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="60" cy="8" r="2.4" fill={color} />
    </svg>
  );
}
