import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { badgeChars, BADGE_COUNT } from '../../lib/graphemes';

const FILLERS = ['!', '🎄', '⭐', '❤️', '✨', '🎁'];

interface Saved {
  phrase: string | null;
  filler: string | null;
  by_day: string[] | null;
}

/** The calendar's badge phrase: each day gives one (scrambled) character; on Dec 25 players unscramble them. */
export default function BadgePhraseEditor({ calendarId }: { calendarId: string }) {
  const [saved, setSaved] = useState<Saved | null>(null);
  const [phrase, setPhrase] = useState('');
  const [filler, setFiller] = useState('!');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = () =>
    supabase.rpc('editor_badge', { p_calendar: calendarId }).then(({ data }) => {
      const s = (data as Saved | null) ?? { phrase: null, filler: null, by_day: null };
      setSaved(s);
      setPhrase(s.phrase ?? '');
      setFiller(s.filler ?? '!');
    });
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarId]);
  if (!saved) return null;

  const { chars, layout, used, tooLong } = badgeChars(phrase, filler);
  const changed = phrase.trim() !== (saved.phrase ?? '') || filler !== (saved.filler ?? '!');

  const save = async () => {
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.rpc('set_badge_phrase', { p_calendar: calendarId, p_phrase: phrase.trim(), p_filler: filler, p_chars: chars, p_layout: layout });
    setBusy(false);
    if (error) return setMessage({ ok: false, text: error.message });
    setMessage({ ok: true, text: saved.phrase ? 'Phrase updated ✓ Everyone’s badges now show the new characters.' : 'Phrase saved ✓' });
    void load();
  };

  return (
    <div className="admin-card finale-editor">
      <button type="button" className="finale-editor-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span>🔤</span>
        <span>
          <strong>Badge phrase</strong>
          <small className={saved.phrase ? undefined : 'admin-warn-text'}>{saved.phrase ? `“${saved.phrase}”` : 'Not set yet: badges stay empty stars'}</small>
        </span>
        <span className="finale-editor-chev">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="finale-editor-body">
          <p className="admin-muted">
            Write a phrase of up to {BADGE_COUNT} characters (spaces don’t count). Each day gives one of its characters as a badge,
            in a scrambled order, and once players have all {BADGE_COUNT} they unscramble them to reveal it, then your finale
            message. You can change it any time; everyone’s badges update.
          </p>
          <input className="badge-phrase-input" value={phrase} onChange={(e) => setPhrase(e.target.value)} maxLength={120} placeholder="e.g. Merry Christmas Ana" />
          <div className="badge-filler">
            <span>Fill the rest with</span>
            {FILLERS.map((f) => (
              <button key={f} type="button" aria-pressed={filler === f} onClick={() => setFiller(f)}>
                {f}
              </button>
            ))}
          </div>
          <p className={tooLong ? 'form-error' : 'admin-muted'}>
            {tooLong
              ? `That’s ${used} characters. Keep it to ${BADGE_COUNT} (spaces don’t count).`
              : `${used} character${used === 1 ? '' : 's'}${used < BADGE_COUNT ? ` + ${BADGE_COUNT - used} × ${filler}` : ''} = ${BADGE_COUNT} badges`}
          </p>
          {!tooLong && used > 0 && (
            <div className="badge-preview" aria-label="Preview">
              {layout.map((len, w) => {
                const start = layout.slice(0, w).reduce((a, b) => a + b, 0);
                return (
                  <span key={w} className="badge-preview-word">
                    {chars.slice(start, start + len).map((c, i) => (
                      <span key={i}>{c}</span>
                    ))}
                  </span>
                );
              })}
            </div>
          )}
          {message && <p className={message.ok ? 'form-info' : 'form-error'}>{message.text}</p>}
          <button type="button" className="admin-save" onClick={save} disabled={busy || tooLong || used === 0 || !changed}>
            {busy ? 'Saving…' : saved.phrase ? 'Update phrase' : 'Save phrase'}
          </button>
          {saved.by_day && (
            <details className="badge-by-day">
              <summary>Which day gives which badge</summary>
              <ol>
                {saved.by_day.map((c, i) => (
                  <li key={i}>
                    <span>Day {i + 1}</span>
                    <strong>{c}</strong>
                  </li>
                ))}
              </ol>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
