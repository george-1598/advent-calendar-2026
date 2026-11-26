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
      <PasswordForm email={email} />
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

function PasswordForm({ email }: { email: string }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (next.length < 6) return setMessage({ ok: false, text: 'The new password needs at least 6 characters.' });
    if (next !== again) return setMessage({ ok: false, text: 'The two new passwords don’t match.' });
    if (next === current) return setMessage({ ok: false, text: 'That’s the same as your current password.' });
    setBusy(true);
    // Confirm it's really you before changing it.
    const check = await supabase.auth.signInWithPassword({ email, password: current });
    if (check.error) {
      setBusy(false);
      return setMessage({ ok: false, text: 'Your current password isn’t right.' });
    }
    const { error } = await supabase.auth.updateUser({ password: next });
    setBusy(false);
    if (error) return setMessage({ ok: false, text: error.message });
    setCurrent('');
    setNext('');
    setAgain('');
    setMessage({ ok: true, text: 'Password changed ✓ Use the new one next time you sign in.' });
  };
  return (
    <form className="profile-card" onSubmit={save}>
      <h2>Password</h2>
      <label>
        <span>Current password</span>
        <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
      </label>
      <label>
        <span>New password</span>
        <input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={6} required />
      </label>
      <label>
        <span>New password again</span>
        <input type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" minLength={6} required />
      </label>
      {message && <p className={message.ok ? 'form-info' : 'form-error'}>{message.text}</p>}
      <button className="btn-primary" disabled={busy || !current || !next || !again}>
        {busy ? 'Changing…' : 'Change password'}
      </button>
    </form>
  );
}
