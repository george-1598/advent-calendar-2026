import { useEffect, useState } from 'react';
import { useUnlocks } from '../lib/unlocks';
import { useTheme } from '../lib/theme';

/** "Lock all themes again", with an are-you-sure step. Shown in the last theme. */
export default function LockAllButton() {
  const { lockAll } = useUnlocks();
  const { setTheme } = useTheme();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setConfirming(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirming]);

  return (
    <>
      <button className="lock-all" onClick={() => setConfirming(true)}>
        🔒 Lock all themes again
      </button>
      {confirming && (
        <div className="unlock-backdrop" onClick={() => setConfirming(false)}>
          <div className="unlock-card lock-confirm" role="alertdialog" aria-modal="true" aria-labelledby="lock-title" onClick={(e) => e.stopPropagation()}>
            <span className="unlock-icon">⚠️</span>
            <h2 id="lock-title">Lock all themes?</h2>
            <p className="unlock-desc">
              Every theme except the Classic grid will be locked again. To get them back you’ll have to find all the
              hidden 🗝 keys again, one theme at a time.
            </p>
            <p className="unlock-desc">Your solved days and gifts are not affected.</p>
            <button
              className="unlock-go"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await lockAll();
                setTheme('classic');
                setBusy(false);
                setConfirming(false);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              {busy ? 'Locking…' : 'Yes, lock them all'}
            </button>
            <button className="unlock-later" onClick={() => setConfirming(false)}>
              No, keep them unlocked
            </button>
          </div>
        </div>
      )}
    </>
  );
}
