import type { CSSProperties } from 'react';
import type { Mail } from './data';

export function StampArt({ art }: { art: Mail['stamp']['art'] }) {
  const d = {
    tree: 'M12 3 L18 12 H15 L20 19 H4 L9 12 H6 Z',
    star: 'M12 3 l2.6 5.6 6 .7 -4.5 4.1 1.2 6 -5.3 -3 -5.3 3 1.2 -6 -4.5 -4.1 6 -.7 Z',
    bell: 'M12 4 C 7 4, 7 10, 6 15 L 4 18 H20 L18 15 C 17 10, 17 4, 12 4 Z M10 19 a2 2 0 0 0 4 0 Z',
    deer: 'M7 6 l2 3 M17 6 l-2 3 M8 4 l1 2 M16 4 l-1 2 M9 9 h6 l1 4 -2 6 h-4 l-2 -6 Z',
  }[art];
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} fill="#FFF6DE" stroke="#FFF6DE" strokeWidth={art === 'deer' ? 1.4 : 0} strokeLinecap="round" />
    </svg>
  );
}

/** The front of an envelope, postcard or parcel as it lies on the desk. */
export function MailFace({ mail, to, sealed, showNumber }: { mail: Mail; to: string; sealed: boolean; showNumber: boolean }) {
  const style = { '--paper': mail.paper, '--ink': mail.ink, '--stamp': mail.stamp.bg } as CSSProperties;

  if (mail.kind === 'parcel') {
    return (
      <span className="mail-face mail-face--parcel" style={style}>
        <span className="parcel-string" />
        <span className="parcel-label">Do not open until Dec 25</span>
      </span>
    );
  }

  return (
    <span className={`mail-face mail-face--${mail.kind}${mail.airmail ? ' is-airmail' : ''}`} style={style}>
      {mail.kind === 'postcard' ? (
        <>
          <span className="postcard-picture">
            <span>Greetings from the North Pole</span>
          </span>
          <span className="postcard-lines" />
        </>
      ) : (
        <>
          <span className="mail-address">
            <span>To {mail.day ? to : 'Santa Claus'}</span>
            <span>{mail.day ? 'With love, by sleigh' : 'North Pole'}</span>
          </span>
        </>
      )}
      <span className="mail-stamp">
        <StampArt art={mail.stamp.art} />
      </span>
      <span className="mail-postmark">
        <span>N. POLE</span>
      </span>
      {showNumber && mail.day && <span className="mail-sortnum">{mail.day}</span>}
      {sealed && <span className="mail-seal" aria-label="wax seal">✦</span>}
    </span>
  );
}
