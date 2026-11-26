import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

/** Change your display name and password. */
export default function ProfilePage() {
  const { session, profile, refreshProfile } = useAuth();
  const email = session?.user.email ?? '';
  return (
    <section className="page profile">
      <h1 className="page-title">Your profile</h1>
      <NameForm current={profile?.display_name ?? ''} onSaved={refreshProfile} />
      <PasswordForm />
      <p className="profile-email">
        Signed in with <strong>{email || '…'}</strong>
      </p>
    </section>
  );
}

function NameForm({ current, onSaved }: { current: string; onSaved: () => void }) {
  const [name, setName] = useState(current);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.rpc('update_display_name', { p_name: name });
    setBusy(false);
    if (error) return setMessage({ ok: false, text: error.message });
    setMessage({ ok: true, text: 'Saved ✓' });
    onSaved();
  };
  return (
    <form className="profile-card" onSubmit={save}>
      <h2>Display name</h2>
      <p className="profile-help">Shown to the calendar’s creator and your friends, and used wherever a quest says your name.</p>
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="nickname" aria-label="Display name" />
      {message && <p className={message.ok ? 'form-info' : 'form-error'}>{message.text}</p>}
      <button className="btn-primary" disabled={busy || !name.trim() || name.trim() === current}>
        {busy ? 'Saving…' : 'Save name'}
      </button>
    </form>
  );
}

function PasswordForm() {
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (next.length < 6) return setMessage({ ok: false, text: 'The new password needs at least 6 characters.' });
    if (next !== again) return setMessage({ ok: false, text: 'The two new passwords don’t match.' });
    setBusy(true);
    // Being signed in is enough: Supabase sets the new password for the current session's user.
    const { error } = await supabase.auth.updateUser({ password: next });
    setBusy(false);
    if (error) return setMessage({ ok: false, text: error.message });
    setNext('');
    setAgain('');
    setMessage({ ok: true, text: 'Password changed ✓ Use the new one next time you sign in.' });
  };
  return (
    <form className="profile-card" onSubmit={save}>
      <h2>Password</h2>
      <label>
        <span>New password</span>
        <input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={6} required />
      </label>
      <label>
        <span>New password again</span>
        <input type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" minLength={6} required />
      </label>
      {message && <p className={message.ok ? 'form-info' : 'form-error'}>{message.text}</p>}
      <button className="btn-primary" disabled={busy || !next || !again}>
        {busy ? 'Changing…' : 'Change password'}
      </button>
    </form>
  );
}
