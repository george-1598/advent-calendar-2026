import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useCalendars } from '../lib/calendars';
import { useProgress } from '../lib/progress';
import { useNow } from '../lib/useNow';
import { isUnlocked, TOTAL_DAYS } from '../lib/time';
import QuestImage, { resizeToJpeg } from './games/QuestImage';

const BUCKET = 'memories';

export interface Memory {
  day: number;
  path: string;
  caption: string | null;
  created_at: string;
}

/** The player's photo memories on the current calendar. */
export function useMemories(): [Memory[] | null, () => void] {
  const { currentId } = useCalendars();
  const { solvedCount } = useProgress();
  const [list, setList] = useState<Memory[] | null>(null);
  const load = useCallback(() => {
    supabase.rpc('my_memories', { p_calendar: currentId }).then(({ data, error }) => setList(error ? [] : ((data as Memory[]) ?? [])));
  }, [currentId]);
  useEffect(load, [load, solvedCount]);
  return [list, load];
}

/** After solving: add a photo of the real gift (only you and the calendar's creator can see it). */
export function MemoryBox({ day }: { day: number }) {
  const { session } = useAuth();
  const { current, currentId, canEdit } = useCalendars();
  const [list, reload] = useMemories();
  const memory = list?.find((m) => m.day === day);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [editing, setEditing] = useState(false);
  useEffect(() => setCaption(memory?.caption ?? ''), [memory?.caption]);
  if (canEdit || list === null) return null;
  const who = current.is_main ? 'the organiser' : current.owner_name ?? 'your friend';
  const userId = session?.user.id ?? 'dev';

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const blob = await resizeToJpeg(file);
      const path = `${currentId}/${userId}/${day}-${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
      if (upErr) throw new Error(upErr.message);
      const { data: old, error: saveErr } = await supabase.rpc('save_memory', { p_calendar: currentId, p_day: day, p_path: path, p_caption: caption });
      if (saveErr) throw new Error(saveErr.message);
      if (old) await supabase.storage.from(BUCKET).remove([old as string]);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
    setBusy(false);
  };
  const remove = async () => {
    setBusy(true);
    const { data: path } = await supabase.rpc('delete_memory', { p_calendar: currentId, p_day: day });
    if (path) await supabase.storage.from(BUCKET).remove([path as string]);
    setBusy(false);
    reload();
  };
  const saveCaption = async () => {
    await supabase.rpc('set_memory_caption', { p_calendar: currentId, p_day: day, p_caption: caption });
    setEditing(false);
    reload();
  };

  const picker = (label: string, primary = false) => (
    <label className={primary ? 'memory-upload memory-upload--primary' : 'memory-upload'}>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void upload(f);
        }}
        disabled={busy}
      />
      <span>{busy ? 'Uploading…' : label}</span>
    </label>
  );

  return (
    <div className="memory">
      {memory ? (
        <>
          <QuestImage path={memory.path} bucket={BUCKET} className="memory-photo" alt={`Memory from December ${day}`} />
          {editing ? (
            <div className="memory-caption-edit">
              <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={200} placeholder="A caption (optional)" />
              <button className="admin-link" onClick={saveCaption}>
                Save
              </button>
            </div>
          ) : (
            memory.caption && <p className="memory-caption">{memory.caption}</p>
          )}
          <div className="memory-actions">
            {picker('Replace photo')}
            {!editing && (
              <button className="admin-link" onClick={() => setEditing(true)}>
                {memory.caption ? 'Edit caption' : 'Add a caption'}
              </button>
            )}
            <button className="admin-link admin-link--danger" onClick={remove} disabled={busy}>
              Remove
            </button>
          </div>
        </>
      ) : (
        <>
          <span className="memory-label">📸 Keep a memory of this gift</span>
          <input className="memory-caption-input" value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={200} placeholder="A caption (optional)" />
          {picker('Add a photo', true)}
          <small className="memory-note">Only you and {who} can see it. On December 25 your photos become “Our December”.</small>
        </>
      )}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}

/** From December 25: all photo memories in day order. */
export function MemoriesBanner() {
  const now = useNow(60000);
  const [list] = useMemories();
  const [open, setOpen] = useState(false);
  if (!isUnlocked(TOTAL_DAYS, now) || !list?.length) return null;
  return (
    <>
      <button className="memories-banner" onClick={() => setOpen(true)}>
        <span>📸</span>
        <span>
          <strong>Our December</strong>
          <small>
            {list.length} photo {list.length === 1 ? 'memory' : 'memories'} from this calendar
          </small>
        </span>
      </button>
      {open && <Gallery list={list} onClose={() => setOpen(false)} />}
    </>
  );
}

function Gallery({ list, onClose }: { list: Memory[]; onClose: () => void }) {
  const [big, setBig] = useState<Memory | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (big ? setBig(null) : onClose());
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [big, onClose]);
  return createPortal(
    <div className="gallery" role="dialog" aria-modal="true" aria-label="Our December">
      <header className="gallery-head">
        <h2>Our December</h2>
        <button onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>
      <div className="gallery-grid">
        {list.map((m) => (
          <button key={m.day} className="gallery-item" onClick={() => setBig(m)}>
            <QuestImage path={m.path} bucket={BUCKET} className="gallery-photo" alt={`December ${m.day}`} />
            <span className="gallery-day">{m.day}</span>
          </button>
        ))}
      </div>
      {big && (
        <div className="gallery-big" onClick={() => setBig(null)}>
          <QuestImage path={big.path} bucket={BUCKET} className="gallery-big-photo" alt={`December ${big.day}`} />
          <p>
            <strong>December {big.day}</strong>
            {big.caption && ` · ${big.caption}`}
          </p>
        </div>
      )}
    </div>,
    document.body,
  );
}
