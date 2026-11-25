import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { THEMES, type ThemeId } from '../../lib/theme';
import { THEME_CHAIN } from '../../lib/unlocks';
import { TOTAL_DAYS, isToday, isUnlocked, unlockAt } from '../../lib/time';
import { useNow } from '../../lib/useNow';

interface PlayerProgress {
  day: number;
  attempts: number;
  solved_at: string | null;
}
interface PlayerUnlock {
  theme: ThemeId;
  unlocked_at: string;
  attempts: number | null;
  started_at: string | null;
}
interface Guess {
  day: number;
  guess: string;
  correct: boolean;
  at: string;
}
export interface Player {
  id: string;
  name: string;
  email: string;
  is_admin: boolean;
  created_at: string;
  last_seen_at: string | null;
  current_theme: ThemeId | null;
  progress: PlayerProgress[];
  unlocks: PlayerUnlock[];
  guesses: Guess[];
}

const themeName = (t: ThemeId | null) => THEMES.find((x) => x.id === t)?.name ?? '—';

export function ago(iso: string | null, now: number): string {
  if (!iso) return 'never';
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

/** Full date and time in Bucharest, e.g. "26 Nov, 23:04:42". */
export function stamp(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Europe/Bucharest',
  });
}

const PAGE_SIZE = 10;

export function duration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
}

function stats(p: Player) {
  const solved = p.progress.filter((x) => x.solved_at);
  const wrong = p.progress.reduce((n, x) => n + x.attempts, 0);
  const hints = p.progress.filter((x) => x.attempts >= 3).length;
  const solveTimes = solved.map((x) => new Date(x.solved_at!).getTime() - unlockAt(x.day)).filter((t) => t > 0);
  return {
    solved: solved.length,
    wrong,
    hints,
    avgGuesses: solved.length ? (solved.reduce((n, x) => n + x.attempts + 1, 0) / solved.length).toFixed(1) : '—',
    fastest: solveTimes.length ? duration(Math.min(...solveTimes)) : '—',
    slowest: solveTimes.length ? duration(Math.max(...solveTimes)) : '—',
    themes: 1 + p.unlocks.length,
  };
}

export default function PlayersTab() {
  const now = useNow(30000);
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState('');

  const load = () => {
    setError(null);
    supabase.rpc('admin_dashboard').then(({ data, error }) => {
      if (error) setError(error.message);
      else setPlayers(data as Player[]);
    });
  };
  useEffect(load, []);

  if (error) return <p className="form-error">{error}</p>;
  if (!players) return <p className="admin-muted">Loading players…</p>;

  const openDays = Array.from({ length: TOTAL_DAYS }, (_, i) => i + 1).filter((d) => isUnlocked(d, now));
  const today = openDays.find((d) => isToday(d, now));
  const solvedToday = today ? players.filter((p) => p.progress.some((x) => x.day === today && x.solved_at)).length : 0;
  const totalSolved = players.reduce((n, p) => n + p.progress.filter((x) => x.solved_at).length, 0);
  const avgThemes = players.length ? (players.reduce((n, p) => n + 1 + p.unlocks.length, 0) / players.length).toFixed(1) : '0';

  const q = query.trim().toLowerCase();
  const filtered = q ? players.filter((p) => `${p.name} ${p.email}`.toLowerCase().includes(q)) : players;
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const shown = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="admin-stack">
      <div className="admin-kpis">
        <div className="admin-kpi">
          <span>{players.length}</span>
          <small>players</small>
        </div>
        <div className="admin-kpi">
          <span>{today ? `${solvedToday}/${players.length}` : '—'}</span>
          <small>{today ? `solved day ${today}` : 'no day open yet'}</small>
        </div>
        <div className="admin-kpi">
          <span>{totalSolved}</span>
          <small>days solved in total</small>
        </div>
        <div className="admin-kpi">
          <span>{avgThemes}</span>
          <small>themes unlocked (avg)</small>
        </div>
      </div>
      <div className="admin-toolbar">
        <input
          className="admin-search"
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
          placeholder="Search players by name or email"
          aria-label="Search players"
        />
        <button className="admin-link" onClick={load}>
          ↻ Refresh
        </button>
      </div>
      {filtered.length === 0 && <p className="admin-muted">No players match “{query}”.</p>}

      {shown.map((p) => {
        const s = stats(p);
        const byDay = new Map(p.progress.map((x) => [x.day, x]));
        const isOpen = open === p.id;
        return (
          <article key={p.id} className="admin-card">
            <button className="admin-player-head" onClick={() => setOpen(isOpen ? null : p.id)} aria-expanded={isOpen}>
              <span className="admin-avatar">{p.name.slice(0, 1).toUpperCase()}</span>
              <span className="admin-player-id">
                <strong>
                  {p.name} {p.is_admin && <em className="admin-badge">admin</em>}
                </strong>
                <small>
                  Seen {ago(p.last_seen_at, now)} · {themeName(p.current_theme)}
                </small>
              </span>
              <span className="admin-player-score">
                <strong>{s.solved}</strong>
                <small>/ {openDays.length || TOTAL_DAYS} solved</small>
              </span>
            </button>

            <div className="admin-days" aria-label="Days">
              {Array.from({ length: TOTAL_DAYS }, (_, i) => i + 1).map((d) => {
                const x = byDay.get(d);
                const cls = x?.solved_at ? 'is-solved' : x ? 'is-tried' : isUnlocked(d, now) ? 'is-open' : 'is-locked';
                const title = x?.solved_at
                  ? `Day ${d}: solved after ${x.attempts} wrong guess${x.attempts === 1 ? '' : 'es'}`
                  : x
                    ? `Day ${d}: ${x.attempts} wrong guess${x.attempts === 1 ? '' : 'es'}, not solved`
                    : `Day ${d}`;
                return (
                  <span key={d} className={`admin-day ${cls}`} title={title}>
                    {x?.solved_at ? '★' : x ? x.attempts : d}
                  </span>
                );
              })}
            </div>

            {isOpen && (
              <div className="admin-detail">
                <dl className="admin-stats">
                  <div><dt>Email</dt><dd>{p.email}</dd></div>
                  <div><dt>Joined</dt><dd>{new Date(p.created_at).toLocaleDateString('en-GB')}</dd></div>
                  <div><dt>Wrong guesses</dt><dd>{s.wrong}</dd></div>
                  <div><dt>Guesses per solve</dt><dd>{s.avgGuesses}</dd></div>
                  <div><dt>Hints shown</dt><dd>{s.hints}</dd></div>
                  <div><dt>Fastest solve</dt><dd>{s.fastest}</dd></div>
                  <div><dt>Slowest solve</dt><dd>{s.slowest}</dd></div>
                  <div><dt>Themes</dt><dd>{s.themes} / {THEME_CHAIN.length}</dd></div>
                </dl>

                <h3>Theme hunt</h3>
                <ol className="admin-chain">
                  {THEME_CHAIN.map((t, i) => {
                    const u = p.unlocks.find((x) => x.theme === t);
                    const from = i > 0 ? themeName(THEME_CHAIN[i - 1]) : null;
                    return (
                      <li key={t} className={i === 0 || u ? 'is-done' : ''}>
                        <strong>{themeName(t)}</strong>
                        {i === 0 ? (
                          <span>starting theme</span>
                        ) : u ? (
                          <>
                            <span>
                              {u.attempts != null ? `${u.attempts} item${u.attempts === 1 ? '' : 's'} opened in ${from}` : 'unlocked'}
                              {u.started_at && ` · took ${duration(new Date(u.unlocked_at).getTime() - new Date(u.started_at).getTime())}`}
                            </span>
                            <small className="admin-times">
                              {u.started_at && <>Started {stamp(u.started_at)} · </>}Unlocked {stamp(u.unlocked_at)}
                            </small>
                          </>
                        ) : (
                          <span>locked</span>
                        )}
                      </li>
                    );
                  })}
                </ol>

                <h3>Recent guesses</h3>
                {p.guesses.length === 0 ? (
                  <p className="admin-muted">No guesses yet.</p>
                ) : (
                  <ul className="admin-guesses">
                    {p.guesses.map((g, i) => (
                      <li key={i} className={g.correct ? 'is-right' : 'is-wrong'}>
                        <span className="admin-guess-day">Day {g.day}</span>
                        <span className="admin-guess-text">“{g.guess}”</span>
                        <span>{g.correct ? '✓' : '✗'}</span>
                        <small title={ago(g.at, now)}>
                          {stamp(g.at)} · {ago(g.at, now)}
                        </small>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </article>
        );
      })}

      {pages > 1 && (
        <nav className="admin-pager" aria-label="Player pages">
          <button onClick={() => setPage(current - 1)} disabled={current === 0}>
            ‹ Prev
          </button>
          <span>
            Page {current + 1} of {pages} · {filtered.length} players
          </span>
          <button onClick={() => setPage(current + 1)} disabled={current >= pages - 1}>
            Next ›
          </button>
        </nav>
      )}
    </div>
  );
}
