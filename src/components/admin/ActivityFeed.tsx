import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { useNow } from '../../lib/useNow';
import { ago } from './PlayersTab';

export interface ActivityEvent {
  type: 'solved' | 'joined' | 'hint' | 'thanks';
  user_id: string;
  name: string;
  day?: number;
  attempts?: number;
  emoji?: string | null;
  body?: string | null;
  at: string;
  unread?: boolean;
}
export interface Stuck {
  user_id: string;
  name: string;
  day: number;
  attempts: number;
  last_attempt_at: string;
  hints_sent: number;
}
export interface Activity {
  events: ActivityEvent[];
  stuck: Stuck[];
}

/** Recent solves, joins, hints and thank-yous, plus friends who are stuck (with a "send a hint" form). */
export default function ActivityFeed({ calendarId, activity, onChanged }: { calendarId: string; activity: Activity | null; onChanged: () => void }) {
  const now = useNow(30000);
  // Thank-yous count as read once the feed has been shown (they stay highlighted this time).
  const unread = activity?.events.some((e) => e.unread) ?? false;
  useEffect(() => {
    // (Supabase only sends a request once it's awaited or .then()'d.)
    if (unread) supabase.rpc('mark_thanks_read', { p_calendar: calendarId }).then(() => undefined);
  }, [unread, calendarId]);

  if (!activity) return <p className="admin-muted">Loading activity…</p>;
  const { events, stuck } = activity;

  return (
    <div className="admin-stack">
      {stuck.length > 0 && (
        <div className="admin-card feed-card">
          <h2>Needs help 🆘</h2>
          <ul className="feed">
            {stuck.map((s) => (
              <StuckRow key={`${s.user_id}-${s.day}`} s={s} calendarId={calendarId} now={now} onSent={onChanged} />
            ))}
          </ul>
        </div>
      )}
      <div className="admin-card feed-card">
        <h2>Recent activity</h2>
        {events.length === 0 && <p className="admin-muted">Nothing yet. Solves, thank-yous and new friends will show up here.</p>}
        <ul className="feed">
          {events.map((e, i) => (
            <li key={i} className={e.unread ? 'feed-item is-new' : 'feed-item'}>
              <span className="feed-icon">{icon(e)}</span>
              <span className="feed-text">
                <span>{describe(e)}</span>
                {e.type === 'thanks' && e.body && <q>{e.body}</q>}
                {e.type === 'hint' && e.body && <q>{e.body}</q>}
                <small>{ago(e.at, now)}</small>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function icon(e: ActivityEvent): string {
  if (e.type === 'solved') return '⭐';
  if (e.type === 'joined') return '👋';
  if (e.type === 'hint') return '💬';
  return e.emoji || '💌';
}

function describe(e: ActivityEvent): string {
  switch (e.type) {
    case 'solved':
      return `${e.name} solved day ${e.day}${e.attempts ? ` after ${e.attempts} wrong ${e.attempts === 1 ? 'try' : 'tries'}` : ' on the first try'}`;
    case 'joined':
      return `${e.name} joined your calendar`;
    case 'hint':
      return `You sent ${e.name} a hint for day ${e.day}`;
    case 'thanks':
      return `${e.name} says thank you for day ${e.day}`;
  }
}

function StuckRow({ s, calendarId, now, onSent }: { s: Stuck; calendarId: string; now: number; onSent: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc('send_hint', { p_calendar: calendarId, p_user: s.user_id, p_day: s.day, p_text: text });
    setBusy(false);
    if (error) return setError(error.message);
    setText('');
    setOpen(false);
    onSent();
  };
  return (
    <li className="feed-item feed-item--stuck">
      <span className="feed-icon">🤔</span>
      <span className="feed-text">
        <span>
          {s.name} is stuck on day {s.day}: {s.attempts} wrong tries
        </span>
        <small>
          last try {ago(s.last_attempt_at, now)}
          {s.hints_sent > 0 && ` · you sent ${s.hints_sent} hint${s.hints_sent > 1 ? 's' : ''}`}
        </small>
        {open ? (
          <form className="feed-hint-form" onSubmit={send}>
            <textarea rows={2} maxLength={300} value={text} onChange={(e) => setText(e.target.value)} placeholder={`A nudge for ${s.name}…`} autoFocus />
            {error && <p className="form-error">{error}</p>}
            <div className="admin-actions">
              <button className="admin-save" disabled={busy || !text.trim()}>
                {busy ? 'Sending…' : 'Send hint'}
              </button>
              <button type="button" className="admin-link" onClick={() => setOpen(false)}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button className="admin-link feed-hint-btn" onClick={() => setOpen(true)}>
            💬 Send {s.name} a hint
          </button>
        )}
      </span>
    </li>
  );
}
