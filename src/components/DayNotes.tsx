import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useProgress } from '../lib/progress';
import { useCalendars } from '../lib/calendars';
import { openDayPage } from '../lib/route';

/** Hints the calendar's creator sent for this day (marked read once seen). */
export function DayHints({ day }: { day: number }) {
  const { notes, refreshNotes } = useProgress();
  const { currentId } = useCalendars();
  const hints = notes.filter((n) => n.kind === 'hint' && n.day === day);
  const unread = hints.some((h) => !h.read_at);
  useEffect(() => {
    if (!unread) return;
    const t = window.setTimeout(() => {
      supabase.rpc('mark_hints_read', { p_calendar: currentId, p_day: day }).then(() => refreshNotes());
    }, 1500);
    return () => window.clearTimeout(t);
  }, [unread, currentId, day, refreshNotes]);
  if (!hints.length) return null;
  return (
    <div className="day-hints">
      {hints.map((h) => (
        <p key={h.id} className={h.read_at ? 'day-hint-note' : 'day-hint-note is-new'}>
          <span>💬</span>
          <span>
            <strong>Hint from {h.from_name ?? 'the organiser'}</strong>
            {h.body}
          </span>
        </p>
      ))}
    </div>
  );
}

const EMOJIS = ['❤️', '😍', '🥹', '😂', '🎉', '🤯'];

/** After solving: send the creator a little thank-you (shown in their activity feed). */
export function ThanksBox({ day }: { day: number }) {
  const { notes, refreshNotes } = useProgress();
  const { current, currentId, canEdit } = useCalendars();
  const sent = notes.find((n) => n.kind === 'thanks' && n.day === day);
  const [open, setOpen] = useState(false);
  const [emoji, setEmoji] = useState(sent?.emoji ?? '❤️');
  const [text, setText] = useState(sent?.body ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (canEdit) return null; // creators previewing their own calendar
  const to = current.is_main ? 'the organiser' : current.owner_name ?? 'your friend';

  if (sent && !open) {
    return (
      <div className="thanks thanks--sent">
        <span className="thanks-emoji">{sent.emoji ?? '💌'}</span>
        <span>
          You sent {to} a thank-you{sent.body ? `: “${sent.body}”` : ''}
        </span>
        <button
          className="admin-link"
          onClick={() => {
            setEmoji(sent.emoji ?? '❤️');
            setText(sent.body ?? '');
            setOpen(true);
          }}
        >
          Change
        </button>
      </div>
    );
  }
  if (!open) {
    return (
      <button className="thanks-open" onClick={() => setOpen(true)}>
        💌 Send {to} a thank-you
      </button>
    );
  }
  const send = async () => {
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc('send_thanks', { p_calendar: currentId, p_day: day, p_emoji: emoji, p_text: text });
    setBusy(false);
    if (error) return setError(error.message);
    setOpen(false);
    refreshNotes();
  };
  return (
    <div className="thanks">
      <span className="thanks-label">Send {to} a thank-you</span>
      <div className="thanks-emojis" role="radiogroup" aria-label="Pick an emoji">
        {EMOJIS.map((e) => (
          <button key={e} role="radio" aria-checked={emoji === e} onClick={() => setEmoji(e)}>
            {e}
          </button>
        ))}
      </div>
      <textarea rows={2} maxLength={300} value={text} onChange={(e) => setText(e.target.value)} placeholder="A few words (optional)" />
      {error && <p className="form-error">{error}</p>}
      <div className="game-row">
        <button className="game-secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
        <button className="game-primary" onClick={send} disabled={busy}>
          {busy ? 'Sending…' : 'Send 💌'}
        </button>
      </div>
    </div>
  );
}

/** On the calendar: unread hints, so they aren't missed. */
export function HintBanner() {
  const { notes } = useProgress();
  const unread = notes.filter((n) => n.kind === 'hint' && !n.read_at);
  if (!unread.length) return null;
  const h = unread[unread.length - 1];
  return (
    <button className="hint-banner" onClick={() => openDayPage(h.day)}>
      <span>💬</span>
      <span>
        <strong>{h.from_name ?? 'The organiser'} sent you a hint</strong>
        <small>for December {h.day}{unread.length > 1 ? ` (+${unread.length - 1} more)` : ''} · tap to see it</small>
      </span>
    </button>
  );
}
