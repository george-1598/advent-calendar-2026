import { THEMES, useTheme } from '../lib/theme';
import { useUnlocks } from '../lib/unlocks';
import { Confetti } from './themes/crackers/Cracker';

/** The "🔓 New theme unlocked" moment. */
export default function UnlockCelebration() {
  const { justUnlocked, dismiss } = useUnlocks();
  const { setTheme } = useTheme();
  if (!justUnlocked) return null;
  const t = THEMES.find((x) => x.id === justUnlocked)!;
  return (
    <div className="unlock-backdrop" onClick={dismiss}>
      <div className="unlock-card" role="dialog" aria-modal="true" aria-labelledby="unlock-title" onClick={(e) => e.stopPropagation()}>
        <Confetti count={40} />
        <span className="unlock-icon">🔓</span>
        <span className="unlock-kicker">You found the key!</span>
        <h2 id="unlock-title">New theme unlocked</h2>
        <p className="unlock-name">{t.name}</p>
        <p className="unlock-desc">{t.description}</p>
        <button
          className="unlock-go"
          onClick={() => {
            setTheme(t.id);
            dismiss();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          Try it now
        </button>
        <button className="unlock-later" onClick={dismiss}>
          Maybe later
        </button>
      </div>
    </div>
  );
}
