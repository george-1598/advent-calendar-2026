import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useCalendars } from '../lib/calendars';
import { goHome } from '../lib/route';
import LoginView from './LoginView';

interface Invite {
  title: string;
  owner_name: string | null;
}

/** #/join/<token>: who invited you, then sign in / sign up, then you're in. */
export default function JoinPage({ token, signedIn }: { token: string; signedIn: boolean }) {
  const { refresh, select } = useCalendars();
  const [invite, setInvite] = useState<Invite | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState<{ id: string; title: string; owner_name: string | null } | null>(null);
  const tried = useRef(false);

  useEffect(() => {
    supabase.rpc('invite_info', { p_token: token }).then(({ data }) => setInvite((data as Invite | null) ?? null));
  }, [token]);

  // Signed in (straight away, or after logging in on this page): join.
  useEffect(() => {
    if (!signedIn || tried.current) return;
    tried.current = true;
    supabase.rpc('join_calendar', { p_token: token }).then(({ data, error }) => {
      if (error) return setError(error.message);
      const cal = data as { id: string; title: string; owner_name: string | null };
      setJoined(cal);
      refresh();
      select(cal.id);
    });
  }, [signedIn, token, refresh, select]);

  const from = invite?.owner_name ?? joined?.owner_name ?? 'A friend';
  const title = invite?.title ?? joined?.title;

  return (
    <section className="join">
      <div className="join-card">
        <span className="join-icon">🎁</span>
        {joined ? (
          <>
            <h1>You’re in!</h1>
            <p>
              <strong>{joined.owner_name ?? 'Your friend'}</strong>’s calendar “{joined.title}” is now in your calendars. Switch
              between calendars at the top of the page.
            </p>
            <button className="btn-primary" onClick={goHome}>
              Open it
            </button>
          </>
        ) : error ? (
          <>
            <h1>Hmm…</h1>
            <p className="form-error">{error}</p>
            <button className="btn-primary" onClick={goHome}>
              Go to the calendar
            </button>
          </>
        ) : invite === null && !signedIn ? (
          <>
            <h1>This link has expired</h1>
            <p>It was already used or cancelled. Ask your friend for a new one.</p>
          </>
        ) : (
          <>
            <h1>{from} made you an advent calendar</h1>
            {title && <p className="join-title">“{title}”</p>}
            <p>25 days of riddles, games and little surprises, one door a day from December 1.</p>
            {signedIn && <p className="admin-muted">Joining…</p>}
          </>
        )}
      </div>
      {!signedIn && invite !== null && (
        <LoginView initialMode="signup" lead="Create an account (or sign in) to open it. It takes 20 seconds." />
      )}
    </section>
  );
}
