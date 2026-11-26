import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { useCalendars } from '../../lib/calendars';
import { goHome, openMine, type MineTab } from '../../lib/route';
import PlayersTab from './PlayersTab';
import QuestsTab from './QuestsTab';

interface MyCalendar {
  id: string;
  title: string;
  members: { email: string; name: string | null }[];
}

const MAX_FRIENDS = 3;
const SITE = `${window.location.origin}${import.meta.env.BASE_URL}`;

/** The signed-in user's own calendar for up to 3 friends. */
export default function MyCalendarPage({ tab }: { tab: MineTab }) {
  const { refresh: refreshCalendars } = useCalendars();
  const [cal, setCal] = useState<MyCalendar | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    supabase.rpc('my_calendar').then(({ data, error }) => {
      if (error) setError(error.message);
      else setCal((data as MyCalendar | null) ?? null);
    });
  }, []);
  useEffect(load, [load]);

  const changed = () => {
    load();
    refreshCalendars();
  };

  if (error) return <section className="admin-page"><p className="form-error">{error}</p></section>;
  if (cal === undefined) return <section className="admin-page"><p className="admin-muted">Loading…</p></section>;
  if (cal === null) return <CreateCalendar onCreated={changed} />;

  return (
    <section className="admin-page">
      <CalendarTitle cal={cal} onSaved={changed} />
      <div className="admin-tabs admin-tabs--3 mine-page-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'friends'} onClick={() => openMine('friends')}>
          Friends
        </button>
        <button role="tab" aria-selected={tab === 'quests'} onClick={() => openMine('quests')}>
          Quests
        </button>
        <button role="tab" aria-selected={tab === 'players'} onClick={() => openMine('players')}>
          Progress
        </button>
      </div>
      {tab === 'friends' && <FriendsTab cal={cal} onChanged={changed} />}
      {tab === 'quests' && <QuestsTab calendarId={cal.id} />}
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
          write yourself. It opens day by day, just like this one, from December 1.
        </p>
        <ol className="mine-steps">
          <li>Name your calendar</li>
          <li>Add your friends’ emails</li>
          <li>Fill in the days: riddles, photos, maps, chains…</li>
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

function FriendsTab({ cal, onChanged }: { cal: MyCalendar; onChanged: () => void }) {
  const { select } = useCalendars();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc('add_calendar_member', { p_email: email });
    setBusy(false);
    if (error) return setError(error.message);
    setEmail('');
    onChanged();
  };

  const remove = async (address: string) => {
    const { error } = await supabase.rpc('remove_calendar_member', { p_email: address });
    setRemoving(null);
    if (error) setError(error.message);
    else onChanged();
  };

  const invite = `I made you an advent calendar 🎄 "${cal.title}". Create an account at ${SITE} with this email address, confirm it, and you’ll find my calendar at the top of the page.`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(invite);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Couldn’t copy. Select the message and copy it yourself.');
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
        {cal.members.length === 0 && <p className="admin-muted">No friends yet. Add up to {MAX_FRIENDS} by email.</p>}
        <ul className="mine-members">
          {cal.members.map((m) => (
            <li key={m.email}>
              <span className={m.name ? 'mine-dot is-joined' : 'mine-dot'} aria-hidden />
              <span className="mine-member">
                <strong>{m.name ?? m.email}</strong>
                <small>{m.name ? `${m.email} · joined ✓` : 'Waiting for them to sign up with this email'}</small>
              </span>
              {removing === m.email ? (
                <span className="mine-confirm">
                  <button className="admin-link admin-link--danger" onClick={() => remove(m.email)}>
                    Remove
                  </button>
                  <button className="admin-link" onClick={() => setRemoving(null)}>
                    Keep
                  </button>
                </span>
              ) : (
                <button className="admin-link" onClick={() => setRemoving(m.email)} aria-label={`Remove ${m.email}`}>
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
        {cal.members.length < MAX_FRIENDS && (
          <form className="mine-add" onSubmit={add}>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="friend@example.com" aria-label="Friend’s email" required />
            <button className="admin-save" disabled={busy}>
              {busy ? 'Adding…' : 'Add'}
            </button>
          </form>
        )}
        {error && <p className="form-error">{error}</p>}
      </div>

      <div className="admin-card mine-share">
        <h2>Tell them about it</h2>
        <p className="admin-muted">
          Nothing is emailed automatically. Send your friends this message: they’ll see your calendar as soon as they sign
          in with the email you added.
        </p>
        <blockquote>{invite}</blockquote>
        <button className="admin-link" onClick={copy}>
          {copied ? 'Copied ✓' : 'Copy message'}
        </button>
      </div>

      <div className="admin-card mine-actions">
        <button className="admin-save" onClick={() => openMine('quests')}>
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
