import { useEffect, useState } from 'react';
import type { GameProps } from './types';
import { useGameSubmit } from './useSubmit';
import { MAIN_CALENDAR, useCalendars } from '../../lib/calendars';
import { clueText, questionText, type EinsteinPuzzle } from './einsteinLogic';

interface Notes {
  /** Clues revealed so far. */
  shown: number;
  /** notes[person][category] = option index, or -1 for "?" */
  table: number[][];
}

/** Logic grid: clues one at a time, a deduction table, then accuse. */
export default function Einstein({ day, content, solved, step }: GameProps) {
  const p = content.einstein as EinsteinPuzzle | undefined;
  const { currentId } = useCalendars();
  const key = `advent-einstein-${currentId === MAIN_CALENDAR ? '' : `${currentId}-`}${day}-${step ?? 0}`;
  const blank = (): Notes => ({ shown: 1, table: (p?.people ?? []).map(() => (p?.categories ?? []).map(() => -1)) });
  const [notes, setNotes] = useState<Notes>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? '') as Notes;
      if (saved.table?.length === p?.people.length) return saved;
    } catch {
      // first visit
    }
    return blank();
  });
  const [picked, setPicked] = useState<number | null>(null);
  const [wrong, setWrong] = useState<number[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const { busy, error, run } = useGameSubmit(day);

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(notes));
    } catch {
      // ignore
    }
  }, [key, notes]);

  if (!p) return null;
  const shown = solved ? p.clues.length : Math.min(notes.shown, p.clues.length);
  const setCell = (person: number, cat: number, v: number) =>
    setNotes((n) => ({ ...n, table: n.table.map((row, i) => (i !== person ? row : row.map((x, k) => (k === cat ? v : x)))) }));
  // An option already given to someone else in the table shows as taken.
  const takenBy = (cat: number, v: number, person: number) => notes.table.findIndex((row, i) => i !== person && row[cat] === v);

  const accuse = async () => {
    if (picked === null) return;
    const res = await run(String(picked));
    if (res && !res.correct) {
      setWrong((w) => [...w, picked]);
      setMessage(`It wasn’t ${p.people[picked]}. Check the clues again!`);
      setPicked(null);
    }
  };

  return (
    <div className="game einstein">
      {content.prompt && <p className="day-prompt">{content.prompt}</p>}
      <p className="einstein-rule">
        Each suspect had a different {p.categories.map((c) => c.name.toLowerCase()).join(', a different ')}.
        {p.categories.filter((c) => c.row).map((c) => ` The ${c.name.toLowerCase()}s are in a row: ${c.values.join(' → ')}.`)}
      </p>

      <div className="einstein-table-wrap">
        <table className="einstein-table">
          <thead>
            <tr>
              <th>Suspect</th>
              {p.categories.map((c, k) => (
                <th key={k}>{c.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {p.people.map((name, i) => (
              <tr key={i} className={wrong.includes(i) ? 'is-out' : undefined}>
                <th>{name}</th>
                {p.categories.map((c, k) => (
                  <td key={k}>
                    <select value={notes.table[i]?.[k] ?? -1} onChange={(e) => setCell(i, k, Number(e.target.value))} aria-label={`${name}: ${c.name}`} className={(notes.table[i]?.[k] ?? -1) >= 0 ? 'is-set' : undefined}>
                      <option value={-1}>?</option>
                      {c.values.map((v, vi) => (
                        <option key={vi} value={vi}>
                          {v}
                          {takenBy(k, vi, i) >= 0 ? ` (${p.people[takenBy(k, vi, i)]}?)` : ''}
                        </option>
                      ))}
                    </select>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="einstein-note">Your notes are only for you, and saved on this phone.</p>

      <ol className="einstein-clues">
        {p.clues.slice(0, shown).map((c, i) => (
          <li key={i} className={i === shown - 1 && !solved ? 'is-new' : undefined}>
            {clueText(p, c)}
          </li>
        ))}
      </ol>
      {shown < p.clues.length && (
        <div className="game-row">
          <button className="game-secondary" onClick={() => setNotes((n) => ({ ...n, shown: n.shown + 1 }))}>
            Reveal clue {shown + 1} of {p.clues.length}
          </button>
          <button className="admin-link" onClick={() => setNotes((n) => ({ ...n, shown: p.clues.length }))}>
            Show all
          </button>
        </div>
      )}

      {!solved && (
        <>
          <p className="einstein-question">🔎 {questionText(p)}</p>
          <div className="einstein-accuse">
            {p.people.map((name, i) => (
              <button key={i} className={['chip-suspect', picked === i && 'is-picked', wrong.includes(i) && 'is-out'].filter(Boolean).join(' ')} disabled={wrong.includes(i)} aria-pressed={picked === i} onClick={() => setPicked(picked === i ? null : i)}>
                {name}
              </button>
            ))}
          </div>
          <button className="game-primary" onClick={accuse} disabled={picked === null || busy}>
            {busy ? 'Checking…' : picked === null ? 'Pick a suspect' : `Accuse ${p.people[picked]}`}
          </button>
        </>
      )}
      {message && !solved && <p className="form-error">{message}</p>}
      {error && <p className="form-error">{error}</p>}
      {notes.table.some((r) => r.some((x) => x >= 0)) && !solved && (
        <button className="admin-link einstein-reset" onClick={() => setNotes((n) => ({ ...blank(), shown: n.shown }))}>
          Clear my notes
        </button>
      )}
    </div>
  );
}
