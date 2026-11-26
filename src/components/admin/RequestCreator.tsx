import { useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';

/** For players: ask the organiser for the creator role (needed to make a calendar for friends). */
export default function RequestCreator({ pausedTitle }: { pausedTitle?: string | null }) {
  const { profile, refreshProfile } = useAuth();
  const status = profile?.creator_status ?? null;
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [again, setAgain] = useState(false);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc('request_creator', { p_note: note });
    setBusy(false);
    if (error) return setError(error.message);
    setAgain(false);
    refreshProfile();
  };
  const cancel = async () => {
    await supabase.rpc('cancel_creator_request');
    refreshProfile();
  };

  if (status === 'pending') {
    return (
      <section className="admin-page">
        <div className="mine-intro">
          <span className="mine-intro-icon">⏳</span>
          <h1 className="page-title">Request sent</h1>
          <p>The organiser will have a look. Once it’s approved, this button turns into “Make a calendar for friends”.</p>
          <button className="admin-link" onClick={cancel}>
            Cancel my request
          </button>
        </div>
      </section>
    );
  }

  const declined = status === 'declined' && !again;
  return (
    <section className="admin-page">
      <div className="mine-intro">
        <span className="mine-intro-icon">{pausedTitle ? '⏸️' : declined ? '🙈' : '🎁'}</span>
        <h1 className="page-title">{pausedTitle ? 'Your calendar is paused' : declined ? 'Not this time' : 'Make your own advent calendar'}</h1>
        {pausedTitle ? (
          <p>
            “{pausedTitle}” is still there for your friends to play, but editing it needs the creator role again. Ask the organiser
            below.
          </p>
        ) : declined ? (
          <p>The organiser didn’t approve your request. You can still enjoy the calendars you’re part of, or ask again.</p>
        ) : (
          <p>
            Creators can make a calendar for up to 3 friends: 25 days of riddles, games and real surprises. Ask the organiser
            and they’ll unlock it for you.
          </p>
        )}
        {declined && (
          <button className="admin-link" onClick={() => setAgain(true)}>
            Ask again
          </button>
        )}
      </div>
      {!declined && (
        <form className="admin-card mine-create" onSubmit={send}>
          <label>
            <span>A note for the organiser (optional)</span>
            <textarea rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. I’d love to make one for my sisters 🎄" />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="admin-save" disabled={busy}>
            {busy ? 'Sending…' : '✋ Ask to become a creator'}
          </button>
        </form>
      )}
    </section>
  );
}
