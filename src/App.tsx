import { useState } from 'react';
import Calendar from './components/Calendar';
import BadgesView from './components/BadgesView';
import AboutView from './components/AboutView';

export type View = 'calendar' | 'badges' | 'about';

const NAV: { id: View; label: string }[] = [
  { id: 'calendar', label: 'Calendar' },
  { id: 'badges', label: 'Badges' },
  { id: 'about', label: 'About' },
];

export default function App() {
  const [view, setView] = useState<View>('calendar');

  const navigate = (next: View) => {
    setView(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <header className="header">
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
      </header>

      <main className="main">
        {view === 'calendar' && <Calendar onNavigate={navigate} />}
        {view === 'badges' && <BadgesView />}
        {view === 'about' && <AboutView />}
      </main>

      <footer className="footer">
        <div className="footer-rule" />
        <p className="footer-small">Made with love for</p>
        <p className="footer-big">Christmas 2026</p>
      </footer>
    </>
  );
}
