import { useRef, useState, type PointerEvent } from 'react';
import { PendingMark } from '../calendar/Pending';
import { useAuth } from '../../lib/auth';
import { playPaperSlide } from '../../lib/sound';
import type { CalendarController } from '../calendar/controller';
import SoundToggle from '../SoundToggle';
import { BLOCKED_MESSAGE, useUnlocks } from '../../lib/unlocks';
import { MailFace } from './mailroom/Envelope';
import LetterReader from './mailroom/LetterReader';
import { MAIL, type Mail } from './mailroom/data';

type Pos = { x: number; y: number; z: number };

/** Neat rows of letters (in order), decoys stacked in a corner. */
function sortedPositions(): Record<string, Pos> {
  const out: Record<string, Pos> = {};
  const letters = MAIL.filter((m) => m.day).sort((a, b) => a.day! - b.day!);
  const cols = 3;
  letters.forEach((m, i) => {
    const row = Math.floor(i / cols);
    out[m.id] = { x: 18 + (i % cols) * 32, y: 6 + row * 10.3, z: 100 + i };
  });
  MAIL.filter((m) => !m.day).forEach((m, i) => {
    out[m.id] = { x: 82 + (i % 2) * 2, y: 93 - i * 0.6, z: 50 + i };
  });
  return out;
}

export default function MailroomCalendar({ ctrl }: { ctrl: CalendarController }) {
  const { profile } = useAuth();
  const to = profile?.display_name || 'you';
  const deskRef = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<Record<string, Pos>>(() =>
    Object.fromEntries(MAIL.map((m, i) => [m.id, { x: m.x, y: m.y, z: i }])),
  );
  const [sorted, setSorted] = useState(false);
  const { found, clue } = useUnlocks();
  const [dragging, setDragging] = useState<string | null>(null);
  const [reading, setReading] = useState<Mail | null>(null);
  const zTop = useRef(MAIL.length + 200);
  const drag = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);

  const onDown = (e: PointerEvent<HTMLButtonElement>, m: Mail) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = positions[m.id];
    drag.current = { id: m.id, sx: e.clientX, sy: e.clientY, ox: p.x, oy: p.y, moved: false };
  };

  const onMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) < 6) return;
    if (!d.moved) {
      d.moved = true;
      setDragging(d.id);
      playPaperSlide();
    }
    const rect = deskRef.current!.getBoundingClientRect();
    const x = Math.max(4, Math.min(96, d.ox + (dx / rect.width) * 100));
    const y = Math.max(3, Math.min(97, d.oy + (dy / rect.height) * 100));
    setPositions((p) => ({ ...p, [d.id]: { x, y, z: ++zTop.current } }));
  };

  const onUp = (m: Mail) => {
    const d = drag.current;
    drag.current = null;
    setDragging(null);
    if (!d || d.moved) return;
    // A tap: open it.
    if (m.kind === 'parcel') {
      ctrl.notify('“Do not open until December 25th” — strict elf orders 📦');
      return;
    }
    setPositions((p) => ({ ...p, [m.id]: { ...p[m.id], z: ++zTop.current } }));
    if (m.day && found('mailroom', m.day, sorted) === 'blocked') ctrl.notify(BLOCKED_MESSAGE);
    setReading(m);
  };

  const toggleSort = () => {
    playPaperSlide();
    if (sorted) {
      setPositions(Object.fromEntries(MAIL.map((m, i) => [m.id, { x: m.x, y: m.y, z: i }])));
    } else {
      setPositions(sortedPositions());
    }
    setSorted(!sorted);
  };

  return (
    <div className="mail-wrap">
      <div className="scratch-head">
        <p className="theme-lead mail-lead">Somewhere in this pile is today’s letter</p>
        <SoundToggle />
      </div>
      <div ref={deskRef} className={sorted ? 'desk is-sorted' : 'desk'}>
        <span className="desk-sprig" aria-hidden="true" />
        <span className="desk-ring" aria-hidden="true">
          <span className="key-ring">{clue('mailroom')}</span>
        </span>
        {MAIL.map((m) => {
          const p = positions[m.id];
          const s = m.day ? ctrl.stateOf(m.day) : null;
          return (
            <button
              key={m.id}
              className={[
                'mail',
                `mail--${m.kind}`,
                dragging === m.id && 'is-dragging',
                s?.solved && 'is-solved',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{ left: `${p.x}%`, top: `${p.y}%`, zIndex: p.z, rotate: sorted ? '0deg' : `${m.rot}deg` }}
              aria-label={m.kind === 'parcel' ? 'A parcel' : sorted && m.day ? `Letter ${m.day}` : 'A letter'}
              onPointerDown={(e) => onDown(e, m)}
              onPointerMove={onMove}
              onPointerUp={() => onUp(m)}
              onPointerCancel={() => {
                drag.current = null;
                setDragging(null);
              }}
            >
              <MailFace mail={m} to={to} sealed={!!s?.today && !s.solved} showNumber={sorted} />
              {sorted && s && <PendingMark state={s} className="pending-mark--mail" />}
            </button>
          );
        })}
      </div>
      <button className="theme-help" onClick={toggleSort} aria-pressed={sorted}>
        {sorted ? 'Mess up the pile again' : 'Sort the mail for me'}
      </button>
      <p className="orn-hint">Drag letters around · tap one to open it · today’s has a wax seal</p>

      {reading && (
        <LetterReader
          mail={reading}
          to={to}
          state={reading.day ? ctrl.stateOf(reading.day) : null}
          now={ctrl.now}
          onQuest={() => {
            const day = reading.day!;
            setReading(null);
            ctrl.open(day, '#7A231C');
          }}
          onClose={() => setReading(null)}
        />
      )}
    </div>
  );
}
