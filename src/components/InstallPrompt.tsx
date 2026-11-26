import { useEffect, useState } from 'react';

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'advent-install-dismissed';

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** "Add to Home Screen": the real install button on Android/Chrome, short instructions on iPhone. */
export default function InstallPrompt() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    const onInstalled = () => setEvent(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (dismissed || isStandalone()) return null;
  const ios = isIos();
  if (!event && !ios) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore
    }
  };
  const install = async () => {
    if (event) {
      await event.prompt();
      const { outcome } = await event.userChoice;
      if (outcome === 'accepted') setEvent(null);
    } else {
      setShowSteps((s) => !s);
    }
  };

  return (
    <div className="install">
      <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" className="install-icon" />
      <div className="install-text">
        <strong>Put the calendar on your home screen</strong>
        <small>Opens like an app, one tap every morning.</small>
      </div>
      <div className="install-actions">
        <button className="install-btn" onClick={install}>
          {event ? 'Install' : showSteps ? 'Got it' : 'How?'}
        </button>
        <button className="install-close" onClick={dismiss} aria-label="Don’t show again">
          ✕
        </button>
      </div>
      {showSteps && (
          <ol className="install-steps">
            <li>
              Tap <span className="install-share" aria-label="Share">⬆︎</span> <strong>Share</strong> at the bottom of Safari
            </li>
            <li>
              Choose <strong>Add to Home Screen</strong>
            </li>
            <li>
              Tap <strong>Add</strong>
            </li>
          </ol>
        )}
    </div>
  );
}
