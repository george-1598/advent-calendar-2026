const KEY = 'advent-stale-reload';

/**
 * Pages load their code on demand. If the app was open during a deploy, the old
 * version asks for files that no longer exist; reload once to get the new
 * version instead of crashing (once per session, so a real outage can't loop).
 */
export function reloadIfStale<T>(load: Promise<T>): Promise<T> {
  return load.catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    const stale = /dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(message);
    let already = false;
    try {
      already = sessionStorage.getItem(KEY) === '1';
      if (stale && !already) sessionStorage.setItem(KEY, '1');
    } catch {
      // ignore
    }
    if (stale && !already) {
      window.location.reload();
      return new Promise<T>(() => undefined); // wait for the reload
    }
    throw err;
  });
}
