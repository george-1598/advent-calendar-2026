import type { CSSProperties } from 'react';
import { PendingMark } from '../../calendar/Pending';
import type { DayState } from '../../calendar/controller';
import { ariaStatus } from '../../calendar/controller';
import { LockIcon, StarIcon } from '../../icons';
import { Bow, CandyCane, SprigArt, Wreath } from './art';
import { patternImage, type GiftDesign } from './designs';

interface Props {
  design: GiftDesign;
  state: DayState;
  unwrapping: boolean;
  shaking: boolean;
  /** The last gift in the grid gets a bigger, full-width spot on phones. */
  grand: boolean;
  onClick: () => void;
}

export default function Gift({ design, state, unwrapping, shaking, grand, onClick }: Props) {
  const { day } = state;
  const style = {
    '--paper': design.paper.bg,
    '--paper-edge': design.paper.edge,
    '--pattern': patternImage(design.pattern, design.paper.dot),
    '--tilt': `${design.tilt}deg`,
    '--phase': `${-design.phase}s`,
    '--kx': `${design.knotX}%`,
    '--ky': `${design.knotY}%`,
    '--deco-rot': `${design.decoRotation}deg`,
    '--tag': design.tag.bg,
    '--tag-ink': design.tag.ink,
    '--tag-rot': `${design.tag.rotation}deg`,
  } as CSSProperties;

  const classes = [
    'gift',
    `gift--${design.shape}`,
    state.canOpen ? 'is-open' : 'is-locked',
    state.today && !state.solved && 'is-today',
    state.solved && 'is-solved',
    unwrapping && 'is-unwrapping',
    shaking && 'is-shaking',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={grand ? 'gift-cell gift-cell--grand' : 'gift-cell'}>
      <button className={classes} style={style} onClick={onClick} aria-label={`December ${day}${ariaStatus(state)}`}>
        <span className="gift-body">
          <span className="gift-box">
            <span className="gift-burst" />
            <StarIcon className="gift-box-star" />
          </span>
          <span className="gift-shadow" />
          <span className="gift-paper gift-paper--l" />
          <span className="gift-paper gift-paper--r" />

          <svg className="gift-twine" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {design.twine.map((line, i) => (
              <path key={i} d={line.d} stroke={line.color} />
            ))}
          </svg>

          {design.deco !== 'none' && (
            <span className="gift-deco">
              {design.deco === 'wreath' && <Wreath />}
              {design.deco === 'cane' && <CandyCane />}
              {design.deco === 'sprig' && <SprigArt />}
            </span>
          )}
          {design.showBow && <Bow color={design.bowColor} />}

          <span className={`gift-tag gift-tag--${design.tag.side}`}>
            <span className="gift-tag-num">{day}</span>
            {!state.unlocked && <LockIcon className="gift-tag-lock" />}
          </span>
          <PendingMark state={state} className="pending-mark--corner" />

          {state.today && !state.solved && (
            <>
              <span className="sparkle sparkle--1">✦</span>
              <span className="sparkle sparkle--2">✦</span>
              <span className="sparkle sparkle--3">✦</span>
            </>
          )}
        </span>
      </button>
    </div>
  );
}
