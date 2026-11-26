import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { useCalendars } from '../../lib/calendars';
import { goHome, inviteUrl, openMine, type MineTab } from '../../lib/route';
import { useNow } from '../../lib/useNow';
import PlayersTab, { ago } from './PlayersTab';
import QuestsTab from './QuestsTab';
import ActivityFeed, { type Activity } from './ActivityFeed';
import Reminders, { type DaySummary } from './Reminders';

interface MyCalendar {
  id: string;
  title: string;
  members: { user_id: string; name: string; joined_at: string }[];
  invites: { token: string; created_at: string }[];
}

const MAX_FRIENDS = 3;

/** The signed-in user's own calendar for up to 3 friends. */
export default function MyCalendarPage({ tab }: { tab: MineTab }) {
  const { refresh: refreshCalendars } = useCalendars();
  const [cal, setCal] = useState<MyCalendar | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<DaySummary[] | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [focusDay, setFocusDay] = useState<{ day: number; at: number } | null>(null);

  const load = useCallback(() => {
    supabase.rpc('my_calendar').then(({ data, error }) => {
      if (error) setError(error.message);
      else setCal((data as MyCalendar | null) ?? null);
    });
  }, []);
  useEffect(load, [load]);

  const calId = cal?.id;
  const loadDays = useCallback(() => {
    if (!calId) return;
    supabase.rpc('admin_quests', { p_calendar: calId }).then(({ data }) => data && setDays(data as DaySummary[]));
  }, [calId]);
  const loadActivity = useCallback(() => {
    if (!calId) return;
    supabase.rpc('calendar_activity', { p_calendar: calId }).then(({ data }) => data && setActivity(data as Activity));
  }, [calId]);
  useEffect(() => {
    loadDays();
    loadActivity();
  }, [loadDays, loadActivity]);

  const changed = () => {
    load();
    refreshCalendars();
  };

  if (error) return <section className="admin-page"><p className="form-error">{error}</p></section>;
  if (cal === undefined) return <section className="admin-page"><p className="admin-muted">Loading…</p></section>;
  if (cal === null) return <CreateCalendar onCreated={changed} />;

  const badge = (activity?.stuck.length ?? 0) + (activity?.events.filter((e) => e.unread).length ?? 0);
  const fill = (day: number) => {
    setFocusDay({ day, at: Date.now() });
    openMine('quests');
  };

  return (
    <section className="admin-page">
      <CalendarTitle cal={cal} onSaved={changed} />
      <Reminders quests={days} onFill={fill} />
      <div className="admin-tabs admin-tabs--4 mine-page-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'friends'} onClick={() => openMine('friends')}>
          Friends
        </button>
        <button role="tab" aria-selected={tab === 'activity'} onClick={() => openMine('activity')}>
          Activity{badge > 0 && <span className="tab-badge">{badge}</span>}
        </button>
        <button role="tab" aria-selected={tab === 'quests'} onClick={() => openMine('quests')}>
          Quests
        </button>
        <button role="tab" aria-selected={tab === 'players'} onClick={() => openMine('players')}>
          Progress
        </button>
      </div>
      {tab === 'friends' && <FriendsTab cal={cal} onChanged={changed} onFill={() => openMine('quests')} />}
      {tab === 'activity' && <ActivityFeed calendarId={cal.id} activity={activity} onChanged={loadActivity} />}
      {tab === 'quests' && <QuestsTab calendarId={cal.id} focusDay={focusDay} onChanged={loadDays} />}
      {tab === 'players' && <PlayersTab calendarId={cal.id} />}
    </section>
  );
}

function CreateCalendar({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const create = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc('create_calendar', { p_title: title });
    setBusy(false);
    if (error) setError(error.message);
    else onCreated();
  };
  return (
    <section className="admin-page">
      <div className="mine-intro">
        <span className="mine-intro-icon">🎁</span>
        <h1 className="page-title">Make your own advent calendar</h1>
        <p>
          Create a calendar for up to {MAX_FRIENDS} friends: 25 days of riddles, games and real-life surprises that you
          write yourself. It opens day by day, just like this one, from December 1. You can fill it in as you go.
        </p>
        <ol className="mine-steps">
          <li>Name your calendar</li>
          <li>Send your friends an invite link</li>
          <li>Fill in the days, starting from examples if you like</li>
        </ol>
      </div>
      <form className="admin-card mine-create" onSubmit={create}>
        <label>
          <span>Calendar name</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="e.g. Christmas with the girls" required />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="admin-save" disabled={busy || !title.trim()}>
          {busy ? 'Creating…' : 'Create my calendar'}
        </button>
      </form>
    </section>
  );
}

function CalendarTitle({ cal, onSaved }: { cal: MyCalendar; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(cal.title);
  const [error, setError] = useState<string | null>(null);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.rpc('rename_calendar', { p_title: title });
    if (error) return setError(error.message);
    setError(null);
    setEditing(false);
    onSaved();
  };
  if (!editing) {
    return (
      <div className="mine-title">
        <span className="mine-kicker">My calendar</span>
        <h1 className="page-title">{cal.title}</h1>
        <button className="admin-link" onClick={() => setEditing(true)}>
          Rename
        </button>
      </div>
    );
  }
  return (
    <form className="mine-title mine-title--edit" onSubmit={save}>
      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} autoFocus aria-label="Calendar name" />
      <button className="admin-save">Save</button>
      <button type="button" className="admin-link" onClick={() => setEditing(false)}>
        Cancel
      </button>
      {error && <p className="form-error">{error}</p>}
    </form>
  );
}

function FriendsTab({ cal, onChanged, onFill }: { cal: MyCalendar; onChanged: () => void; onFill: () => void }) {
  const { select } = useCalendars();
  const now = useNow(60000);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const slots = MAX_FRIENDS - cal.members.length - cal.invites.length;

  const newLink = async () => {
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc('create_invite');
    setBusy(false);
    if (error) setError(error.message);
    else onChanged();
  };
  const run = async (fn: string, args: Record<string, string>) => {
    const { error } = await supabase.rpc(fn, args);
    setRemoving(null);
    if (error) setError(error.message);
    else onChanged();
  };

  const message = (token: string) =>
    `I made you an advent calendar 🎄 “${cal.title}”. Open this link to join (it works once, just for you): ${inviteUrl(token)}`;
  const share = async (token: string) => {
    const text = message(token);
    try {
      if (navigator.share) {
        await navigator.share({ title: cal.title, text });
        return;
      }
    } catch {
      return; // share sheet closed
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(token);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setError('Couldn’t copy. Press and hold the link to copy it yourself.');
    }
  };

  const preview = () => {
    select(cal.id);
    goHome();
  };

  return (
    <div className="admin-stack">
      <div className="admin-card mine-friends">
        <h2>
          Friends <small>{cal.members.length} / {MAX_FRIENDS}</small>
        </h2>
        {cal.members.length === 0 && cal.invites.length === 0 && (
          <p className="admin-muted">No friends yet. Create an invite link for each friend (up to {MAX_FRIENDS}).</p>
        )}
        <ul className="mine-members">
          {cal.members.map((m) => (
            <li key={m.user_id}>
              <span className="mine-dot is-joined" aria-hidden />
              <span className="mine-member">
                <strong>{m.name}</strong>
                <small>joined {ago(m.joined_at, now)}</small>
              </span>
              {removing === m.user_id ? (
                <span className="mine-confirm">
                  <button className="admin-link admin-link--danger" onClick={() => run('remove_calendar_member', { p_user: m.user_id })}>
                    Remove
                  </button>
                  <button className="admin-link" onClick={() => setRemoving(null)}>
                    Keep
                  </button>
                </span>
              ) : (
                <button className="admin-link" onClick={() => setRemoving(m.user_id)} aria-label={`Remove ${m.name}`}>
                  ✕
                </button>
              )}
            </li>
          ))}
          {cal.invites.map((i) => (
            <li key={i.token} className="mine-invite">
              <span className="mine-dot" aria-hidden />
              <span className="mine-member">
                <strong>Invite link, not used yet</strong>
                <code className="mine-link">{inviteUrl(i.token)}</code>
                <span className="mine-invite-actions">
                  <button className="admin-link" onClick={() => share(i.token)}>
                    {copied === i.token ? 'Copied ✓' : 'Share / copy'}
                  </button>
                  {removing === i.token ? (
                    <>
                      <button className="admin-link admin-link--danger" onClick={() => run('revoke_invite', { p_token: i.token })}>
                        Cancel this link
                      </button>
                      <button className="admin-link" onClick={() => setRemoving(null)}>
                        Keep
                      </button>
                    </>
                  ) : (
                    <button className="admin-link admin-link--danger" onClick={() => setRemoving(i.token)}>
                      Cancel
                    </button>
                  )}
                </span>
              </span>
            </li>
          ))}
        </ul>
        {slots > 0 && (
          <button className="admin-save" onClick={newLink} disabled={busy}>
            {busy ? 'Creating…' : '+ Create an invite link'}
          </button>
        )}
        <p className="admin-muted mine-help">
          Each link works once: the friend opens it, signs up or logs in, and your calendar appears for them. No emails needed.
        </p>
        {error && <p className="form-error">{error}</p>}
      </div>

      <div className="admin-card mine-actions">
        <button className="admin-save" onClick={onFill}>
          Fill in the days →
        </button>
        <button className="admin-link" onClick={preview}>
          Preview my calendar
        </button>
      </div>

      <div className="admin-card mine-danger">
        {confirmDelete ? (
          <DeleteCalendar cal={cal} onCancel={() => setConfirmDelete(false)} onDeleted={onChanged} />
        ) : (
          <button className="admin-link admin-link--danger" onClick={() => setConfirmDelete(true)}>
            Delete this calendar…
          </button>
        )}
      </div>
    </div>
  );
}

function DeleteCalendar({ cal, onCancel, onDeleted }: { cal: MyCalendar; onCancel: () => void; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      // Photos first (day folders under the calendar's folder), then everything else.
      const bucket = supabase.storage.from('quest-images');
      const { data: folders } = await bucket.list(cal.id, { limit: 100 });
      for (const f of folders ?? []) {
        const { data: files } = await bucket.list(`${cal.id}/${f.name}`, { limit: 200 });
        if (files?.length) await bucket.remove(files.map((x) => `${cal.id}/${f.name}/${x.name}`));
      }
      const { error } = await supabase.rpc('delete_my_calendar');
      if (error) throw new Error(error.message);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setBusy(false);
    }
  };
  return (
    <div className="mine-delete">
      <strong>Delete “{cal.title}”?</strong>
      <p>All its days, photos and your friends’ progress and badges will be gone for good. This can’t be undone.</p>
      {error && <p className="form-error">{error}</p>}
      <div className="admin-actions">
        <button className="admin-save admin-save--danger" onClick={run} disabled={busy}>
          {busy ? 'Deleting…' : 'Yes, delete it'}
        </button>
        <button className="admin-link" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>
  );
}
