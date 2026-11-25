import { useCallback, useState } from 'react';
import { useAuth } from './auth';

/**
 * A set of numbers remembered on this device, per user — e.g. which scratch
 * cards are revealed or which village windows are lit. Purely cosmetic: the
 * server still decides what is unlocked and solved.
 */
export function useExplored(name: string) {
  const { session } = useAuth();
  const key = `advent:${name}:${session?.user?.id ?? 'guest'}`;

  const read = (k: string) => {
    try {
      const raw = localStorage.getItem(k);
      return new Set<number>(raw ? (JSON.parse(raw) as number[]) : []);
    } catch {
      return new Set<number>();
    }
  };

  const [state, setState] = useState(() => ({ key, set: read(key) }));
  let current = state;
  if (state.key !== key) {
    current = { key, set: read(key) };
    setState(current);
  }

  const write = (k: string, set: Set<number>) => {
    try {
      localStorage.setItem(k, JSON.stringify([...set]));
    } catch {
      // storage unavailable — keep it in memory only
    }
  };

  const add = useCallback((n: number) => {
    setState((prev) => {
      if (prev.set.has(n)) return prev;
      const set = new Set(prev.set).add(n);
      write(prev.key, set);
      return { key: prev.key, set };
    });
  }, []);

  const addMany = useCallback((ns: number[]) => {
    setState((prev) => {
      const set = new Set(prev.set);
      ns.forEach((n) => set.add(n));
      write(prev.key, set);
      return { key: prev.key, set };
    });
  }, []);

  const remove = useCallback((n: number) => {
    setState((prev) => {
      if (!prev.set.has(n)) return prev;
      const set = new Set(prev.set);
      set.delete(n);
      write(prev.key, set);
      return { key: prev.key, set };
    });
  }, []);

  const clear = useCallback(() => {
    setState((prev) => {
      write(prev.key, new Set());
      return { key: prev.key, set: new Set() };
    });
  }, []);

  return { has: (n: number) => current.set.has(n), add, addMany, remove, clear, size: current.set.size };
}
