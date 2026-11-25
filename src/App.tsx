import { useState } from 'react';
import Calendar from './components/Calendar';
import BadgesView from './components/BadgesView';
import AboutView from './components/AboutView';
import LoginView from './components/LoginView';
import { useAuth } from './lib/auth';

export type View = 'calendar' | 'badges' | 'about';

const NAV: { id: View; label: string }[] = [
  { id: 'calendar', label: 'Calendar' },
  { id: 'badges', label: 'Badges' },
  { id: 'about', label: 'About' },
];

export default function App() {
  const { session, loading } = useAuth();
  const [view, setView] = useState<View>('calendar');

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
      </footer>
    </>
  );
}
