import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { installErrorHandlers } from './lib/errorLog';
import { AuthProvider } from './lib/auth';
import { ProgressProvider } from './lib/progress';
import { CalendarsProvider } from './lib/calendars';
import { ThemeProvider } from './lib/theme';
import { UnlocksProvider } from './lib/unlocks';
import './styles.css';
import './themes.css';
import './themes-more.css';
import './themes-3.css';

installErrorHandlers();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
    <AuthProvider>
      <CalendarsProvider>
        <ProgressProvider>
          <UnlocksProvider>
            <ThemeProvider>
              <App />
            </ThemeProvider>
          </UnlocksProvider>
        </ProgressProvider>
      </CalendarsProvider>
    </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);

// Installable app: a light service worker (network first, offline fallback). Production only.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => undefined);
  });
}
