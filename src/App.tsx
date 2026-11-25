import { useCallback, useState } from 'react';
import ThemePicker from './components/ThemePicker';
import Calendar from './components/Calendar';
import BadgesView from './components/BadgesView';
import AboutView from './components/AboutView';
import LoginView from './components/LoginView';
import { signOut, useAuth } from './lib/auth';

export type View = 'calendar' | 'badges' | 'about';

const NAV: { id: View; label: string }[] = [
  { id: 'calendar', label: 'Calendar' },
  { id: 'badges', label: 'Badges' },
  { id: 'about', label: 'About' },
];

export default function App() {
  const auth = useAuth();
  const { profile, loading } = auth;
  // Local development only: add ?nologin to view the calendar without signing in.
  // `import.meta.env.DEV` is false in production builds, so this never ships.
  const devPreview = import.meta.env.DEV && new URLSearchParams(window.location.search).has('nologin');
  const session = auth.session ?? (devPreview ? ({} as NonNullable<typeof auth.session>) : null);
  const [view, setView] = useState<View>('calendar');
  const [pickerOpen, setPickerOpen] = useState(false);
  const closePicker = useCallback(() => setPickerOpen(false), []);

  const navigate = (next: View) => {
    setView(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <header className="header">
        {session ? (
          <nav className="nav" aria-label="Main">
            {NAV.map((item) => (
              <button
                key={item.id}
                aria-current={view === item.id ? 'page' : undefined}
                onClick={() => navigate(item.id)}
              >
                {item.label}
              </button>
            ))}
            <button onClick={() => setPickerOpen(true)} aria-haspopup="dialog">
              Theme
            </button>
          </nav>
        ) : (
          <div className="nav nav--plain">Advent Calendar 2026</div>
        )}
      </header>

      <main className="main">
        {loading ? null : !session ? (
          <LoginView />
        ) : (
          <>
            {view === 'calendar' && <Calendar onNavigate={navigate} />}
            {view === 'badges' && <BadgesView />}
            {view === 'about' && <AboutView />}
          </>
        )}
      </main>

      <footer className="footer">
        <div className="footer-rule" />
        <p className="footer-small">Made with love for</p>
        <p className="footer-big">Christmas 2026</p>
        {session && (
          <div className="account">
            <span className="account-name">
              Signed in as <strong>{profile?.display_name ?? '…'}</strong>
              {profile?.is_admin && <span className="admin-tag">Admin</span>}
            </span>
            <button className="btn-logout" onClick={signOut}>
              Log out
            </button>
          </div>
        )}
      </footer>

      {pickerOpen && <ThemePicker onClose={closePicker} />}
    </>
  );
}
