import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthProvider } from './lib/auth';
import { ProgressProvider } from './lib/progress';
import { CalendarsProvider } from './lib/calendars';
import { ThemeProvider } from './lib/theme';
import { UnlocksProvider } from './lib/unlocks';
import './styles.css';
import './themes.css';
import './themes-more.css';
import './themes-3.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
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
  </StrictMode>,
);
