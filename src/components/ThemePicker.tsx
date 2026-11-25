import { useEffect, useRef } from 'react';
import { THEMES, useTheme, type ThemeId } from '../lib/theme';

function Preview({ id }: { id: ThemeId }) {
  if (id === 'classic') {
    return (
      <span className="tp tp--classic">
        {['#C9DDCB', '#FF6B5E', '#0E4F5A', '#2B2B2B', '#C9DDCB', '#0E4F5A', '#FF6B5E', '#C9DDCB'].map((c, i) => (
          <span key={i} style={{ background: c }} />
        ))}
      </span>
    );
  }
  if (id === 'presents') {
    return (
      <span className="tp tp--presents">
        {['#BFE0DC', '#EE4A33', '#C98D52', '#3F5D8C', '#F8CFC6', '#46B57A'].map((c, i) => (
          <span key={i} className="tp-gift" style={{ background: c }} />
        ))}
      </span>
    );
  }
  return (
    <span className="tp tp--carousel">
      <span className="tp-drum">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className="tp-drawer" style={{ background: i % 2 ? '#0F4D33' : '#B3172C' }} />
        ))}
      </span>
    </span>
  );
}

export default function ThemePicker({ onClose }: { onClose: () => void }) {
  const { theme, setTheme } = useTheme();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="theme-title" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2 id="theme-title">Choose a theme</h2>
          <button ref={closeRef} className="sheet-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="theme-options">
          {THEMES.map((t) => (
            <button
              key={t.id}
              className={t.id === theme ? 'theme-option is-active' : 'theme-option'}
              aria-pressed={t.id === theme}
              onClick={() => {
                setTheme(t.id);
                onClose();
              }}
            >
              <Preview id={t.id} />
              <span className="theme-text">
                <span className="theme-name">{t.name}</span>
                <span className="theme-desc">{t.description}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
