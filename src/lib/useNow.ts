import { useEffect, useState } from 'react';
import { now } from './time';

/** Current time (respecting the ?date preview), re-rendered every second. */
export function useNow(intervalMs = 1000): number {
  const [value, setValue] = useState(now);
  useEffect(() => {
    const id = window.setInterval(() => setValue(now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return value;
}
