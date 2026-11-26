import { useState } from 'react';
import { useProgress, type SubmitResult } from '../../lib/progress';

/** Wraps the server submit with busy/error state for a game. */
export function useGameSubmit(day: number) {
  const { submit } = useProgress();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (answer: string): Promise<SubmitResult | null> => {
    setBusy(true);
    setError(null);
    try {
      return await submit(day, answer);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      return null;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}
