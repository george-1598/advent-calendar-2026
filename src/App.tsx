import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import DayPage from './components/DayPage';
import { goHome, openAdmin, openMine, openProfile, savedScroll, stripCalendarFromUrl, useRoute } from './lib/route';
import ProfilePage from './components/ProfilePage';
import Tour from './components/Tour';
import { useCalendars } from './lib/calendars';
import { reloadIfStale } from './lib/staleReload';
// Admin pages (and their map/QR tools) load only for admins who open them.
const AdminPage = lazy(() => reloadIfStale(import('./components/admin/AdminPage')));
const MyCalendarPage = lazy(() => reloadIfStale(import('./components/admin/MyCalendarPage')));
import ThemePicker from './components/ThemePicker';
import UnlockCelebration from './components/UnlockCelebration';
import Calendar from './components/Calendar';
import BadgesView from './components/BadgesView';
import AboutView from './components/AboutView';
import LoginView from './components/LoginView';
import JoinPage from './components/JoinPage';
import { isCreator, signOut, useAuth } from './lib/auth';

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
  const [loggingOut, setLoggingOut] = useState(false);
  const route = useRoute();
  const { calendars, currentId, select } = useCalendars();
  const hasOwnCalendar = calendars.some((c) => c.is_owner);

  // Links like #/c/<id>/day/7/CODE (treasure QR codes) switch to that calendar first.
  useEffect(() => {
    if (!route.calendar) return;
    select(route.calendar);
    stripCalendarFromUrl();
  }, [route.calendar, select]);
  const switching = Boolean(route.calendar && route.calendar !== currentId);

  // Coming back from a day page: restore where the calendar was scrolled to.
  useEffect(() => {
    if (route.name !== 'home') return;
    const y = savedScroll();
    if (y !== null) requestAnimationFrame(() => window.scrollTo(0, y));
  }, [route]);
  const closePicker = useCallback(() => setPickerOpen(false), []);

  const navigate = (next: View) => {
    if (route.name !== 'home') goHome();
    setView(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <header className="header">
        {session ? (
          <nav className={profile?.is_admin ? 'nav nav--admin' : 'nav'} aria-label="Main">
            {NAV.map((item) => (
              <button
                key={item.id}
                aria-current={view === item.id && route.name === 'home' ? 'page' : undefined}
                onClick={() => navigate(item.id)}
              >
                {item.label}
              </button>
            ))}
            <button onClick={() => setPickerOpen(true)} aria-haspopup="dialog">
              Theme
            </button>
            {profile?.is_admin && (
              <button aria-current={route.name === 'admin' ? 'page' : undefined} onClick={() => openAdmin()}>
                Admin
              </button>
            )}
          </nav>
        ) : (
          <div className="nav nav--plain">Advent Calendar 2026</div>
        )}
      </header>

      <main className="main">
        {loading ? null : route.name === 'join' ? (
          <JoinPage token={route.token} signedIn={Boolean(session)} />
        ) : !session ? (
          <LoginView />
        ) : (
          <>
            {switching ? null : route.name === 'admin' ? (
              <Suspense fallback={<p className="admin-muted">Loading…</p>}>
                <AdminPage tab={route.tab} />
              </Suspense>
            ) : route.name === 'mine' ? (
              <Suspense fallback={<p className="admin-muted">Loading…</p>}>
                <MyCalendarPage tab={route.tab} />
              </Suspense>
            ) : route.name === 'profile' ? (
              <ProfilePage />
            ) : route.name === 'day' ? (
              <DayPage day={route.day} code={route.code} />
            ) : (
              view === 'calendar' && <Calendar onNavigate={navigate} />
            )}
            {route.name === 'home' && view === 'badges' && <BadgesView />}
            {route.name === 'home' && view === 'about' && <AboutView />}
          </>
        )}
      </main>

      <footer className="footer">
        <div className="footer-rule" />
        <p className="footer-small">Made with love for</p>
        <p className="footer-big">Christmas 2026</p>
        {session && (
          <div className="account">
            <button className="account-name" onClick={openProfile} aria-current={route.name === 'profile' ? 'page' : undefined}>
              Signed in as <strong>{profile?.display_name ?? '…'}</strong>
              {profile?.is_admin && <span className="admin-tag">Admin</span>}
              <span className="account-edit">⚙️ Profile</span>
            </button>
            <button className="btn-mine" onClick={() => openMine()} aria-current={route.name === 'mine' ? 'page' : undefined}>
              {isCreator(profile)
                ? hasOwnCalendar
                  ? '🎁 My calendar for friends'
                  : '🎁 Make a calendar for friends'
                : profile?.creator_status === 'pending'
                  ? '⏳ Calendar request sent'
                  : '✋ Ask to make your own calendar'}
            </button>
            <button
              className="btn-logout"
              disabled={loggingOut}
              onClick={() => {
                setLoggingOut(true);
                void signOut();
              }}
            >
              {loggingOut ? 'Logging out…' : 'Log out'}
            </button>
          </div>
        )}
      </footer>

      {pickerOpen && <ThemePicker onClose={closePicker} />}
      <UnlockCelebration />
      {session && route.name !== 'join' && <Tour />}
    </>
  );
}
