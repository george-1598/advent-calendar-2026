import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { formatCountdown } from '../../lib/time';
import { useNow } from '../../lib/useNow';
import { openDayPage } from '../../lib/route';
import type { Player } from './PlayersTab';
import { EditorCalendar, useEditorCalendar } from './editorCalendar';
import { TEMPLATES } from './templates';
import { MAIN_CALENDAR, useCalendars } from '../../lib/calendars';
import GameFields, { cleanAnswers, validateGame } from './GameFields';
import { GAME_KINDS, type GameContent, type GameKind } from '../games/types';

interface QuestFields {
  title: string | null;
  kind: string | null;
  content: GameContent | null;
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

/** The form's editable values (empty = not set). */
interface Form {
  title: string;
  kind: string;
  content: GameContent;
  answers: string[];
  reward: string;
  hint: string;
  letter: string;
  /** Player only: whether they get their own game content (vs. the default game). */
  customGame: boolean;
}
const DEFAULT = 'default';
/** Up to this many players, show them all as buttons; beyond it, show a search box. */
const SHOW_ALL_UP_TO = 6;

const toForm = (q: QuestFields | undefined, fallbackKind = ''): Form => ({
  title: q?.title ?? '',
  kind: q?.kind ?? fallbackKind,
  content: q?.content ?? {},
  answers: q?.answers ?? [],
  reward: q?.reward ?? '',
  hint: q?.hint ?? '',
  letter: q?.badge_letter ?? '',
  customGame: Boolean(q?.content || q?.answers),
});

export default function QuestsTab({
  calendarId = MAIN_CALENDAR,
  focusDay,
  onChanged,
}: {
  calendarId?: string;
  /** Open this day's editor (e.g. from a reminder). */
  focusDay?: { day: number; at: number } | null;
  /** Called after quests load or change (reminders refresh). */
  onChanged?: () => void;
}) {
  const now = useNow(30000);
  const [quests, setQuests] = useState<AdminQuest[] | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<number | null>(null);

  const load = () => {
    supabase.rpc('admin_quests', { p_calendar: calendarId }).then(({ data, error }) => {
      if (error) setError(error.message);
      else setQuests(data as AdminQuest[]);
    });
  };
  const saved = () => {
    load();
    onChanged?.();
  };

  useEffect(() => {
    if (!focusDay || !quests) return;
    setEditing(focusDay.day);
    requestAnimationFrame(() => document.getElementById(`quest-day-${focusDay.day}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusDay, quests === null]);
  useEffect(() => {
    load();
    supabase.rpc('admin_dashboard', { p_calendar: calendarId }).then(({ data }) => data && setPlayers(data as Player[]));
  }, []);

  if (error) return <p className="form-error">{error}</p>;
  if (!quests) return <p className="admin-muted">Loading quests…</p>;

  const ready = quests.filter((q) => q.title).length;

  return (
    <EditorCalendar.Provider value={calendarId}>
    <div className="admin-stack">
      <FinaleEditor calendarId={calendarId} />
      <p className="admin-muted">
        {ready} of 25 days have a default quest. Each day can also be customised per player. Answers are checked
        ignoring capitals, accents, spaces and punctuation.
      </p>
      {quests.map((q) => {
        const live = new Date(q.unlock_at).getTime() <= now;
        const status = !q.title ? (q.overrides.length ? 'Custom' : 'Empty') : live ? 'Live' : 'Ready';
        return (
          <article key={q.day} id={`quest-day-${q.day}`} className={`admin-card admin-quest is-${status.toLowerCase()}`}>
            <button className="admin-quest-head" onClick={() => setEditing(editing === q.day ? null : q.day)} aria-expanded={editing === q.day}>
              <span className="admin-quest-day">{q.day}</span>
              <span className="admin-quest-title">
                <strong>{q.title ?? (q.overrides.length ? 'Only for some players' : 'No quest yet')}</strong>
                {q.title && <em className="admin-kind">{GAME_KINDS.find((g) => g.id === (q.kind ?? 'riddle'))?.label.split(' (')[0]}</em>}
                <small>
                  {live ? 'Opened' : `Opens in ${formatCountdown(new Date(q.unlock_at).getTime() - now)}`}
                  {(q.title || q.overrides.length > 0) && ` · solved by ${q.solved_by}`}
                  {q.overrides.length > 0 && ` · ✎ ${q.overrides.length} custom`}
                </small>
              </span>
              <span className={`admin-status admin-status--${status.toLowerCase()}`}>{status}</span>
            </button>
            {editing === q.day && <QuestEditor quest={q} live={live} players={players} onSaved={saved} />}
          </article>
        );
      })}
    </div>
    </EditorCalendar.Provider>
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
  const calendarId = useEditorCalendar();
  const { select: selectCalendar } = useCalendars();
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
  // Bumped when an example loads, so game fields with their own state start fresh.
  const [templateRev, setTemplateRev] = useState(0);

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

  // The game type in effect for this target (a player inherits the default's unless changed).
  const kind = ((isDefault ? form.kind : form.kind || def.kind) || 'riddle') as GameKind;
  const kindChanged = !isDefault && Boolean(form.kind) && form.kind !== def.kind;
  const gameIsCustom = isDefault || form.customGame || kindChanged;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const answers = cleanAnswers(kind, form.answers);
    if (gameIsCustom) {
      const problem = validateGame(kind, form.content, answers);
      if (problem) return setMessage({ ok: false, text: problem });
    }
    setBusy(true);
    const { error } = isDefault
      ? await supabase.rpc('admin_save_quest', {
          p_day: quest.day,
          p_title: form.title,
          p_kind: kind,
          p_content: form.content,
          p_answers: answers,
          p_reward: form.reward,
          p_hint: form.hint,
          p_badge_letter: form.letter,
          p_calendar: calendarId,
        })
      : await supabase.rpc('admin_save_override', {
          p_user: target,
          p_day: quest.day,
          p_title: form.title,
          p_kind: form.kind,
          p_content: gameIsCustom ? form.content : null,
          p_answers: gameIsCustom ? answers : [],
          p_reward: form.reward,
          p_hint: form.hint,
          p_badge_letter: form.letter,
          p_calendar: calendarId,
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
      p_calendar: calendarId,
    });
    setBusy(false);
    if (error) return setMessage({ ok: false, text: error.message });
    setDrafts((d) => ({ ...d, [target]: toForm(undefined) }));
    setMessage({ ok: true, text: `${player?.name} now sees the default ✓` });
    onSaved();
  };

  const remove = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('admin_delete_quest', { p_day: quest.day, p_calendar: calendarId });
    setBusy(false);
    if (error) setMessage({ ok: false, text: error.message });
    else {
      setConfirmDelete(false);
      setMessage({ ok: true, text: 'Default quest deleted' });
      onSaved();
    }
  };

  return (
    // noValidate: the editor validates itself (browser checks could silently block saving).
    <form className="admin-editor" onSubmit={save} noValidate>
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

      {isDefault && (
        <label className="admin-template">
          <span>✨ Start from an example (optional)</span>
          <select
            value=""
            onChange={(e) => {
              const t = TEMPLATES.find((x) => x.id === e.target.value);
              if (!t) return;
              setDrafts((d) => ({
                ...d,
                [DEFAULT]: { ...form, title: t.title, kind: t.kind, content: t.content, answers: t.answers, hint: t.hint ?? '' },
              }));
              setTemplateRev((r) => r + 1);
              setMessage({ ok: true, text: 'Example loaded. Make it yours, write the gift, then save.' });
            }}
          >
            <option value="">Pick an example…</option>
            {TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <label>
        <span>Title</span>
        <input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder={ph(def.title, 'e.g. Where it all began')} />
      </label>
      <label>
        <span>Game type</span>
        <select
          value={form.kind}
          onChange={(e) => {
            const k = e.target.value;
            // A different game type starts from a blank game.
            setDrafts((d) => ({ ...d, [target]: { ...form, kind: k, content: {}, answers: [], customGame: Boolean(k) } }));
            setMessage(null);
          }}
        >
          {!isDefault && <option value="">Same as default ({GAME_KINDS.find((g) => g.id === (def.kind || 'riddle'))?.label})</option>}
          {GAME_KINDS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
        </select>
      </label>

      {!isDefault && !kindChanged && (
        <label className="admin-check">
          <input
            type="checkbox"
            checked={form.customGame}
            onChange={(e) =>
              setDrafts((d) => ({
                ...d,
                // Start their custom game from a copy of the default.
                [target]: { ...form, customGame: e.target.checked, content: e.target.checked ? structuredClone(def.content) : {}, answers: e.target.checked ? [...def.answers] : [] },
              }))
            }
          />
          <span>Give {player?.name} their own version of the game (riddle, answers…)</span>
        </label>
      )}

      {gameIsCustom ? (
        <div className="admin-game">
          <GameFields
            key={`${target}-${kind}-${templateRev}`}
            day={quest.day}
            kind={kind}
            content={form.content}
            answers={form.answers}
            onChange={(content, answers) => setDrafts((d) => ({ ...d, [target]: { ...(d[target] ?? form), content, answers } }))}
          />
        </div>
      ) : (
        <p className="admin-muted">{player?.name} plays the default game{def.content.prompt ? `: “${def.content.prompt}”` : ''}.</p>
      )}

      <label>
        <span>Gift / surprise (shown when solved)</span>
        <textarea rows={2} value={form.reward} onChange={(e) => set('reward', e.target.value)} placeholder={ph(def.reward, 'Look under your pillow 🎁')} />
      </label>
      <label>
        <span>Hints (one per line, up to 3)</span>
        <textarea
          rows={3}
          value={form.hint}
          onChange={(e) => set('hint', e.target.value)}
          placeholder={ph(def.hint, 'Hint 1 (after 3 wrong tries)\nHint 2 (after 6)\nHint 3 (after 9)')}
        />
        {form.hint.split('\n').filter((l) => l.trim()).length > 3 && <small className="admin-warn-text">Only the first 3 lines are used.</small>}
        <small>After 10 wrong tries players can also give up: they see the answer and the gift, with a grey badge.</small>
      </label>
      <p className="admin-tip">
        💡 Write <code>{'{name}'}</code> anywhere (title, question, gift, hints) and each player sees their own first name.
      </p>
      <div className="admin-row">
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
          <button type="button" className="admin-link" onClick={() => {
            selectCalendar(calendarId);
            openDayPage(quest.day, '#7A231C');
          }}>
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

/** The calendar's finale: shown once a player has finished every filled-in day (from Dec 24). */
function FinaleEditor({ calendarId }: { calendarId: string }) {
  const [text, setText] = useState<string | null>(null);
  const [saved, setSaved] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    supabase.rpc('editor_finale', { p_calendar: calendarId }).then(({ data }) => {
      setText((data as string | null) ?? '');
      setSaved((data as string | null) ?? '');
    });
  }, [calendarId]);
  if (text === null) return null;
  const save = async () => {
    const { error } = await supabase.rpc('set_finale', { p_calendar: calendarId, p_message: text });
    if (error) return setMessage({ ok: false, text: error.message });
    setSaved(text);
    setMessage({ ok: true, text: 'Finale saved ✓' });
  };
  return (
    <div className="admin-card finale-editor">
      <button type="button" className="finale-editor-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span>🎉</span>
        <span>
          <strong>Finale message</strong>
          <small>{saved ? `“${saved.slice(0, 60)}${saved.length > 60 ? '…' : ''}”` : 'Not written yet'}</small>
        </span>
        <span className="finale-editor-chev">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="finale-editor-body">
          <p className="admin-muted">
            When a player has finished every day you filled in (from December 24), their badge letters come together into a word
            and this message appears. Use the badge letters to spell something, e.g. J-O-Y or a name.
          </p>
          <textarea rows={4} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Merry Christmas {name}! Your last surprise is behind the sofa 🎄" />
          {message && <p className={message.ok ? 'form-info' : 'form-error'}>{message.text}</p>}
          <button type="button" className="admin-save" onClick={save} disabled={text === saved}>
            Save finale
          </button>
        </div>
      )}
    </div>
  );
}
