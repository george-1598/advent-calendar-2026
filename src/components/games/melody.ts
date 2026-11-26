/** Parse a simple melody: "E5 E5 E5:2 - G5 C5:1.5 D5:0.5". Octave defaults to 5, beats to 1; "-" is a rest. */
export interface Note {
  midi: number | null;
  beats: number;
}

const SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function parseMelody(text: string): { notes: Note[]; errors: string[] } {
  const notes: Note[] = [];
  const errors: string[] = [];
  for (const raw of text.trim().split(/\s+/).filter(Boolean)) {
    const [head, dur] = raw.split(':');
    const beats = dur ? Number(dur) : 1;
    if (!Number.isFinite(beats) || beats <= 0) {
      errors.push(raw);
      continue;
    }
    if (head === '-' || head.toLowerCase() === 'r') {
      notes.push({ midi: null, beats });
      continue;
    }
    const m = head.match(/^([A-Ga-g])([#b]?)(\d)?$/);
    if (!m) {
      errors.push(raw);
      continue;
    }
    const semi = SEMI[m[1].toUpperCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    const octave = m[3] ? Number(m[3]) : 5;
    notes.push({ midi: 12 * (octave + 1) + semi, beats });
  }
  return { notes, errors };
}
