/** "The Four Suspects": statements are structured so the puzzle can be checked. */
export type ClaimType = 'did' | 'didnt' | 'lying' | 'truthful';

export interface Suspect {
  name: string;
  says: { type: ClaimType; target: number };
}

export const CLAIMS: { id: ClaimType; label: string }[] = [
  { id: 'did', label: 'did it' },
  { id: 'didnt', label: 'didn’t do it' },
  { id: 'lying', label: 'is lying' },
  { id: 'truthful', label: 'is telling the truth' },
];

export const EXAMPLE_SUSPECTS: Suspect[] = [
  { name: 'George', says: { type: 'did', target: 1 } },
  { name: 'Gabii', says: { type: 'did', target: 3 } },
  { name: 'Carla', says: { type: 'didnt', target: 2 } },
  { name: 'Ade', says: { type: 'lying', target: 1 } },
];

/** The sentence a suspect says, e.g. "Gabii did it." or "I didn't do it." */
export function statementText(suspects: Suspect[], i: number): string {
  const { type, target } = suspects[i].says;
  const self = target === i;
  const who = self ? 'I' : suspects[target]?.name || '…';
  switch (type) {
    case 'did':
      return self ? 'I did it.' : `${who} did it.`;
    case 'didnt':
      return self ? 'I didn’t do it.' : `${who} didn’t do it.`;
    case 'lying':
      return self ? 'I am lying.' : `${who} is lying.`;
    case 'truthful':
      return self ? 'I am telling the truth.' : `${who} is telling the truth.`;
  }
}

/**
 * For each possible culprit, find truth values for the statements that are
 * consistent (each statement is true exactly when what it says holds) with
 * exactly one true statement. Returns the culprits that fit, with who tells the truth.
 */
export function solve(suspects: Suspect[]): { culprit: number; truthTeller: number }[] {
  const n = suspects.length;
  const fits: { culprit: number; truthTeller: number }[] = [];
  for (let culprit = 0; culprit < n; culprit++) {
    for (let teller = 0; teller < n; teller++) {
      // Assume exactly statement `teller` is true; check every statement agrees.
      const truth = suspects.map((_, k) => k === teller);
      const ok = suspects.every((s, k) => {
        const { type, target } = s.says;
        const holds = type === 'did' ? culprit === target : type === 'didnt' ? culprit !== target : type === 'lying' ? !truth[target] : truth[target];
        return holds === truth[k];
      });
      if (ok) {
        fits.push({ culprit, truthTeller: teller });
        break;
      }
    }
  }
  return fits;
}
