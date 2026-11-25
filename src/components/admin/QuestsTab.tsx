import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { formatCountdown } from '../../lib/time';
import { useNow } from '../../lib/useNow';
import { openDayPage } from '../../lib/route';
import type { Player } from './PlayersTab';

interface QuestFields {
  title: string | null;
  kind: string | null;
  content: { prompt?: string } | null;
  answers: string[] | null;
  reward: string | null;
  hint: string | null;
  badge_letter: string | null;
}
interface Override extends QuestFields {
  user_id: string;
}
interface AdminQuest extends QuestFields {
  day: number;
  unlock_at: string;
  solved_by: number;
  overrides: Override[];
}

/** The form's editable values (strings; empty = not set). */
interface Form {
  title: string;
  kind: string;
  prompt: string;
  answers: string;
  reward: string;
  hint: string;
  letter: string;
}

const KINDS = [{ id: 'riddle', label: 'Riddle / question (type the answer)' }];
const DEFAULT = 'default';
/** Up to this many players, show them all as buttons; beyond it, show a search box. */
const SHOW_ALL_UP_TO = 6;

const toForm = (q: QuestFields | undefined, fallbackKind = ''): Form => ({
  title: q?.title ?? '',
  kind: q?.kind ?? fallbackKind,
  prompt: q?.content?.prompt ?? '',
  answers: (q?.answers ?? []).join('\n'),
  reward: q?.reward ?? '',
  hint: q?.hint ?? '',
  letter: q?.badge_letter ?? '',
});

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
        {ready} of 25 days have a default quest. Each day can also be customised per player. Answers are checked
        ignoring capitals, accents, spaces and punctuation.
      </p>
      {quests.map((q) => {
        const live = new Date(q.unlock_at).getTime() <= now;
        const status = !q.title ? (q.overrides.length ? 'Custom' : 'Empty') : live ? 'Live' : 'Ready';
        return (
          <article key={q.day} className={`admin-card admin-quest is-${status.toLowerCase()}`}>
            <button className="admin-quest-head" onClick={() => setEditing(editing === q.day ? null : q.day)} aria-expanded={editing === q.day}>
              <span className="admin-quest-day">{q.day}</span>
              <span className="admin-quest-title">
                <strong>{q.title ?? (q.overrides.length ? 'Only for some players' : 'No quest yet')}</strong>
                <small>
                  {live ? 'Opened' : `Opens in ${formatCountdown(new Date(q.unlock_at).getTime() - now)}`}
                  {(q.title || q.overrides.length > 0) && ` · solved by ${q.solved_by}`}
                  {q.overrides.length > 0 && ` · ✎ ${q.overrides.length} custom`}
                </small>
              </span>
              <span className={`admin-status admin-status--${status.toLowerCase()}`}>{status}</span>
            </button>
            {editing === q.day && <QuestEditor quest={q} live={live} players={players} onSaved={load} />}
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
}: {
  quest: AdminQuest;
  live: boolean;
  players: Player[];
  onSaved: () => void;
}) {
  const overrideOf = (id: string) => quest.overrides.find((o) => o.user_id === id);
  // One draft per target, so switching between players keeps unsaved edits.
  const [drafts, setDrafts] = useState<Record<string, Form>>(() => ({
    [DEFAULT]: toForm(quest, 'riddle'),
    ...Object.fromEntries(players.map((p) => [p.id, toForm(overrideOf(p.id))])),
  }));
  const [target, setTarget] = useState<string>(DEFAULT);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [query, setQuery] = useState('');

  const isDefault = target === DEFAULT;
  const choose = (id: string) => {
    setTarget(id);
    setMessage(null);
    setQuery('');
  };
  // Few players: all as buttons. Many: only customised ones (+ the current one), and a search box.
  const compact = players.length > SHOW_ALL_UP_TO;
  const chipPlayers = compact ? players.filter((p) => overrideOf(p.id) || p.id === target) : players;
  const q = query.trim().toLowerCase();
  const matches = q ? players.filter((p) => `${p.name} ${p.email}`.toLowerCase().includes(q)).slice(0, 8) : [];
  const form = drafts[target] ?? toForm(isDefault ? quest : overrideOf(target));
  const def = drafts[DEFAULT];
  const set = (k: keyof Form, v: string) => setDrafts((d) => ({ ...d, [target]: { ...form, [k]: v } }));
  const player = players.find((p) => p.id === target);
  const hasOverride = !isDefault && Boolean(overrideOf(target));
  // Placeholder text: for a player, show what they'd get from the default.
  const ph = (fromDefault: string, fallback: string) => (isDefault ? fallback : fromDefault ? `Default: ${fromDefault}` : 'Same as default (empty)');

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const answers = form.answers.split('\n').map((a) => a.trim()).filter(Boolean);
    const { error } = isDefault
      ? await supabase.rpc('admin_save_quest', {
          p_day: quest.day,
          p_title: form.title,
          p_kind: form.kind || 'riddle',
          p_content: { ...(quest.content ?? {}), prompt: form.prompt },
          p_answers: answers,
          p_reward: form.reward,
          p_hint: form.hint,
          p_badge_letter: form.letter,
        })
      : await supabase.rpc('admin_save_override', {
          p_user: target,
          p_day: quest.day,
          p_title: form.title,
          p_kind: form.kind,
          p_content: form.prompt ? { prompt: form.prompt } : null,
          p_answers: answers,
          p_reward: form.reward,
          p_hint: form.hint,
          p_badge_letter: form.letter,
        });
    setBusy(false);
    setMessage(error ? { ok: false, text: error.message } : { ok: true, text: isDefault ? 'Default saved ✓' : `Saved for ${player?.name} ✓` });
    if (!error) onSaved();
  };

  const resetPlayer = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('admin_save_override', {
      p_user: target,
      p_day: quest.day,
      p_title: null,
      p_kind: null,
      p_content: null,
      p_answers: [],
      p_reward: null,
      p_hint: null,
      p_badge_letter: null,
    });
    setBusy(false);
    if (error) return setMessage({ ok: false, text: error.message });
    setDrafts((d) => ({ ...d, [target]: toForm(undefined) }));
    setMessage({ ok: true, text: `${player?.name} now sees the default ✓` });
    onSaved();
  };

  const remove = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('admin_delete_quest', { p_day: quest.day });
    setBusy(false);
    if (error) setMessage({ ok: false, text: error.message });
    else {
      setConfirmDelete(false);
      setMessage({ ok: true, text: 'Default quest deleted' });
      onSaved();
    }
  };

  return (
    <form className="admin-editor" onSubmit={save}>
      <div className="admin-targets" role="tablist" aria-label="Who sees this">
        <span className="admin-targets-label">Who sees this</span>
        <div className="admin-target-chips">
          <button
            type="button"
            role="tab"
            aria-selected={isDefault}
            className="admin-chip"
            onClick={() => {
              setTarget(DEFAULT);
              setMessage(null);
            }}
          >
            Everyone (default)
          </button>
          {chipPlayers.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={target === p.id}
              className={overrideOf(p.id) ? 'admin-chip has-custom' : 'admin-chip'}
              onClick={() => {
                setTarget(p.id);
                setMessage(null);
              }}
            >
              {p.name}
              {overrideOf(p.id) && ' ✎'}
            </button>
          ))}
        </div>
        {compact && (
          <div className="admin-player-search">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Find a player by name or email (${players.length} players)`}
              aria-label="Find a player to customise"
            />
            {q && (
              <ul className="admin-player-results" role="listbox">
                {matches.length === 0 && <li className="admin-muted">No players match “{query}”.</li>}
                {matches.map((p) => (
                  <li key={p.id}>
                    <button type="button" role="option" aria-selected={target === p.id} onClick={() => choose(p.id)}>
                      <strong>{p.name}</strong>
                      <small>{p.email}</small>
                      {overrideOf(p.id) && <em>✎ custom</em>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {isDefault ? (
        live && quest.title && (
          <p className="admin-warning">⚠️ This day is already live{quest.solved_by ? ` and solved by ${quest.solved_by}` : ''}. Changes apply immediately.</p>
        )
      ) : (
        <p className="admin-note">
          Customising for <strong>{player?.name}</strong>. Leave a field empty to use the default (shown faintly).
          {live && ' This day is live — changes apply immediately.'}
        </p>
      )}

      <label>
        <span>Title</span>
        <input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder={ph(def.title, 'e.g. Where it all began')} />
      </label>
      <label>
        <span>Game type</span>
        <select value={form.kind} onChange={(e) => set('kind', e.target.value)}>
          {!isDefault && <option value="">Same as default</option>}
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
        <textarea rows={4} value={form.prompt} onChange={(e) => set('prompt', e.target.value)} placeholder={ph(def.prompt, 'What the player sees')} />
      </label>
      <label>
        <span>Accepted answers (one per line)</span>
        <textarea
          rows={3}
          value={form.answers}
          onChange={(e) => set('answers', e.target.value)}
          placeholder={isDefault ? 'snowman\na snowman' : def.answers ? `Default:\n${def.answers}` : 'Same as default (empty)'}
        />
      </label>
      <label>
        <span>Gift / surprise (shown when solved)</span>
        <textarea rows={2} value={form.reward} onChange={(e) => set('reward', e.target.value)} placeholder={ph(def.reward, 'Look under your pillow 🎁')} />
      </label>
      <div className="admin-row">
        <label>
          <span>Hint (after 3 wrong tries)</span>
          <input value={form.hint} onChange={(e) => set('hint', e.target.value)} placeholder={ph(def.hint, '')} />
        </label>
        <label className="admin-narrow">
          <span>Badge letter</span>
          <input value={form.letter} maxLength={2} onChange={(e) => set('letter', e.target.value.toUpperCase())} placeholder={isDefault ? '' : def.letter} />
        </label>
      </div>

      {message && <p className={message.ok ? 'form-info' : 'form-error'}>{message.text}</p>}
      <div className="admin-actions">
        <button className="admin-save" disabled={busy}>
          {busy ? 'Saving…' : isDefault ? 'Save default' : `Save for ${player?.name}`}
        </button>
        {(quest.title || quest.overrides.length > 0) && (
          <button type="button" className="admin-link" onClick={() => openDayPage(quest.day, '#7A231C')}>
            Preview (as you) →
          </button>
        )}
        {!isDefault && hasOverride && (
          <button type="button" className="admin-link" onClick={resetPlayer} disabled={busy}>
            Reset {player?.name} to default
          </button>
        )}
        {isDefault &&
          quest.title &&
          (confirmDelete ? (
            <span className="admin-confirm">
              Delete the default quest?{' '}
              <button type="button" className="admin-danger" onClick={remove} disabled={busy}>
                Yes, delete
              </button>{' '}
              <button type="button" className="admin-link" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
            </span>
          ) : (
            <button type="button" className="admin-link admin-link--danger" onClick={() => setConfirmDelete(true)}>
              Delete default
            </button>
          ))}
      </div>
    </form>
  );
}
