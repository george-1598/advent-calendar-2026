import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';

type Mode = 'signin' | 'signup';

export default function LoginView({ initialMode = 'signin', lead }: { initialMode?: Mode; lead?: string }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setInfo(null);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: name.trim() } },
      });
      if (error) setError(error.message);
      else if (!data.session) setInfo('Almost there! Check your inbox to confirm your email.');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    }
    setBusy(false);
  };

  return (
    <section className="login">
      <div className="login-head">
        <span className="logo-script">Advent</span>
        <span className="login-sub">Calendar 2026</span>
        <p className="login-lead">
          {lead ??
            (mode === 'signin'
              ? 'Welcome back. Sign in to open today’s door.'
              : 'Create your account to start your journey.')}
        </p>
      </div>

      <div className="login-tabs" role="tablist">
        <button role="tab" aria-selected={mode === 'signin'} onClick={() => switchMode('signin')}>
          Sign in
        </button>
        <button role="tab" aria-selected={mode === 'signup'} onClick={() => switchMode('signup')}>
          Create account
        </button>
      </div>

      <form className="login-form" onSubmit={onSubmit}>
        {mode === 'signup' && (
          <label>
            <span>Your name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="given-name" />
          </label>
        )}
        <label>
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            inputMode="email"
          />
        </label>
        <label>
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          />
        </label>

        {error && <p className="form-error">{error}</p>}
        {info && <p className="form-info">{info}</p>}

        <button className="btn-primary" disabled={busy}>
          {busy ? 'One moment…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </form>
    </section>
  );
}
