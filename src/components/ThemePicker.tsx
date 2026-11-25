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
  if (id === 'books') {
    return (
      <span className="tp tp--books">
        {['#A8322D', '#2F5E3F', '#22355A', '#C28A2C', '#7C1F1D', '#2C5F67', '#5B2E4A', '#A8322D'].map((c, i) => (
          <span key={i} className="tp-book" style={{ background: c, height: [44, 52, 40, 56, 48, 42, 54, 46][i] }} />
        ))}
      </span>
    );
  }
  if (id === 'scratch') {
    return (
      <span className="tp tp--scratch">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={i === 4 ? 'tp-card tp-card--open' : 'tp-card'}>
            {i === 4 ? '7' : ''}
          </span>
        ))}
      </span>
    );
  }
  if (id === 'village') {
    return (
      <span className="tp tp--village">
        {[
          { left: 8, h: 34, c: '#5E84B4' },
          { left: 36, h: 44, c: '#B4453A' },
          { left: 64, h: 30, c: '#4F7A6F' },
        ].map((h, i) => (
          <span key={i} className="tp-house" style={{ left: h.left, height: h.h, background: h.c }}>
            <span className={i === 1 ? 'tp-win tp-win--on' : 'tp-win'} style={{ left: 4, top: 8 }} />
            <span className={i === 0 ? 'tp-win tp-win--on' : 'tp-win'} style={{ left: 15, top: 8 }} />
            <span className="tp-win" style={{ left: 9, top: 22 }} />
          </span>
        ))}
      </span>
    );
  }
  if (id === 'ornaments') {
    return (
      <span className="tp tp--ornaments">
        <span className="tp-tree" />
        {[
          { l: 6, t: 14, c: '#C8102E' },
          { l: 78, t: 30, c: '#D4A017' },
          { l: 44, t: 56, c: '#1D4E9E' },
          { l: 86, t: 6, c: '#6B2C91' },
        ].map((o, i) => (
          <span key={i} className="tp-orn" style={{ left: o.l, top: o.t, background: o.c }} />
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
