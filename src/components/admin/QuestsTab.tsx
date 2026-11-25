import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { formatCountdown } from '../../lib/time';
import { useNow } from '../../lib/useNow';
import { openDayPage } from '../../lib/route';
import type { Player } from './PlayersTab';

interface AdminQuest {
  day: number;
  unlock_at: string;
  title: string | null;
  kind: string | null;
  content: { prompt?: string } | null;
  answers: string[] | null;
  reward: string | null;
  hint: string | null;
  badge_letter: string | null;
  solved_by: number;
  overrides: { user_id: string; reward: string }[];
}

const KINDS = [{ id: 'riddle', label: 'Riddle / question (type the answer)' }];

export default function QuestsTab() {
  const now = useNow(30000);
  const [quests, setQuests] = useState<AdminQuest[] | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<number | null>(null);

  const load = () => {
    supabase.rpc('admin_quests').then(({ data, error }) => {
      if (error) setError(error.message);
      else setQuests(data as AdminQuest[]);
    });
  };
  useEffect(() => {
    load();
    supabase.rpc('admin_dashboard').then(({ data }) => data && setPlayers(data as Player[]));
  }, []);

  if (error) return <p className="form-error">{error}</p>;
  if (!quests) return <p className="admin-muted">Loading quests…</p>;

  const ready = quests.filter((q) => q.title).length;

  return (
    <div className="admin-stack">
      <p className="admin-muted">
        {ready} of 25 days have a quest. Answers are checked ignoring capitals, accents, spaces and punctuation.
      </p>
      {quests.map((q) => {
        const live = new Date(q.unlock_at).getTime() <= now;
        const status = !q.title ? 'Empty' : live ? 'Live' : 'Ready';
        return (
          <article key={q.day} className={`admin-card admin-quest is-${status.toLowerCase()}`}>
            <button className="admin-quest-head" onClick={() => setEditing(editing === q.day ? null : q.day)} aria-expanded={editing === q.day}>
              <span className="admin-quest-day">{q.day}</span>
              <span className="admin-quest-title">
                <strong>{q.title ?? 'No quest yet'}</strong>
                <small>
                  {live ? 'Opened' : `Opens in ${formatCountdown(new Date(q.unlock_at).getTime() - now)}`}
                  {q.title && ` · solved by ${q.solved_by}`}
                </small>
              </span>
              <span className={`admin-status admin-status--${status.toLowerCase()}`}>{status}</span>
            </button>
            {editing === q.day && (
              <QuestEditor
                quest={q}
                live={live}
                players={players}
                onSaved={() => {
                  load();
                }}
                onClose={() => setEditing(null)}
              />
            )}
          </article>
        );
      })}
    </div>
  );
}

function QuestEditor({
  quest,
  live,
  players,
  onSaved,
  onClose,
}: {
  quest: AdminQuest;
  live: boolean;
  players: Player[];
  onSaved: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(quest.title ?? '');
  const [kind, setKind] = useState(quest.kind ?? 'riddle');
  const [prompt, setPrompt] = useState(quest.content?.prompt ?? '');
  const [answers, setAnswers] = useState((quest.answers ?? []).join('\n'));
  const [reward, setReward] = useState(quest.reward ?? '');
  const [hint, setHint] = useState(quest.hint ?? '');
  const [letter, setLetter] = useState(quest.badge_letter ?? '');
  const [overrides, setOverrides] = useState<Record<string, string>>(
    Object.fromEntries(quest.overrides.map((o) => [o.user_id, o.reward])),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.rpc('admin_save_quest', {
      p_day: quest.day,
      p_title: title,
      p_kind: kind,
      p_content: { ...(quest.content ?? {}), prompt },
      p_answers: answers.split('\n').map((a) => a.trim()).filter(Boolean),
      p_reward: reward,
      p_hint: hint,
      p_badge_letter: letter,
    });
    if (!error) {
      // Per-player gift overrides (empty = use the default gift).
      for (const p of players) {
        const before = quest.overrides.find((o) => o.user_id === p.id)?.reward ?? '';
        const after = overrides[p.id] ?? '';
        if (before !== after) {
          await supabase.rpc('admin_set_user_reward', { p_user: p.id, p_day: quest.day, p_reward: after });
        }
      }
    }
    setBusy(false);
    setMessage(error ? { ok: false, text: error.message } : { ok: true, text: 'Saved ✓' });
    if (!error) onSaved();
  };

  const remove = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('admin_delete_quest', { p_day: quest.day });
    setBusy(false);
    if (error) setMessage({ ok: false, text: error.message });
    else {
      onSaved();
      onClose();
    }
  };

  return (
    <form className="admin-editor" onSubmit={save}>
      {live && quest.title && (
        <p className="admin-warning">⚠️ This day is already live{quest.solved_by ? ` and solved by ${quest.solved_by}` : ''}. Changes apply immediately.</p>
      )}
      <label>
        <span>Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Where it all began" />
      </label>
      <label>
        <span>Game type</span>
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          {KINDS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
        </select>
        <small>More game types (jigsaw, wordle, memory…) will appear here as they’re built.</small>
      </label>
      <label>
        <span>Riddle / question</span>
        <textarea rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="What the player sees" />
      </label>
      <label>
        <span>Accepted answers (one per line)</span>
        <textarea rows={3} value={answers} onChange={(e) => setAnswers(e.target.value)} placeholder={'snowman\na snowman'} />
      </label>
      <label>
        <span>Gift / surprise (shown when solved)</span>
        <textarea rows={2} value={reward} onChange={(e) => setReward(e.target.value)} placeholder="Look under your pillow 🎁" />
      </label>
      <div className="admin-row">
        <label>
          <span>Hint (after 3 wrong tries)</span>
          <input value={hint} onChange={(e) => setHint(e.target.value)} />
        </label>
        <label className="admin-narrow">
          <span>Badge letter</span>
          <input value={letter} maxLength={2} onChange={(e) => setLetter(e.target.value.toUpperCase())} />
        </label>
      </div>
      {players.length > 0 && (
        <fieldset className="admin-overrides">
          <legend>Gift per player (optional — overrides the default above)</legend>
          {players.map((p) => (
            <label key={p.id}>
              <span>{p.name}</span>
              <input
                value={overrides[p.id] ?? ''}
                onChange={(e) => setOverrides((o) => ({ ...o, [p.id]: e.target.value }))}
                placeholder="Same as default"
              />
            </label>
          ))}
        </fieldset>
      )}
      {message && <p className={message.ok ? 'form-info' : 'form-error'}>{message.text}</p>}
      <div className="admin-actions">
        <button className="admin-save" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        {quest.title && (
          <button type="button" className="admin-link" onClick={() => openDayPage(quest.day, '#7A231C')}>
            Preview day {quest.day} →
          </button>
        )}
        {quest.title &&
          (confirmDelete ? (
            <span className="admin-confirm">
              Delete this quest?{' '}
              <button type="button" className="admin-danger" onClick={remove} disabled={busy}>
                Yes, delete
              </button>{' '}
              <button type="button" className="admin-link" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
            </span>
          ) : (
            <button type="button" className="admin-link admin-link--danger" onClick={() => setConfirmDelete(true)}>
              Delete quest
            </button>
          ))}
      </div>
    </form>
  );
}
