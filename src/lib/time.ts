export const YEAR = 2026;
export const TOTAL_DAYS = 25;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

// Europe/Bucharest is UTC+2 (EET) for all of November and December — no DST
// change inside the advent window, so a fixed offset is exact.
const BUCHAREST_OFFSET = 2 * HOUR;

/** Instant (ms since epoch) when a day's door opens: 00:00 Bucharest time on Dec <day>. */
export const unlockAt = (day: number) => Date.UTC(YEAR, 11, day) - BUCHAREST_OFFSET;

export const isUnlocked = (day: number, now: number) => now >= unlockAt(day);

export const isToday = (day: number, now: number) =>
  now >= unlockAt(day) && now < unlockAt(day) + DAY;

export function nextUnlock(now: number): { day: number; at: number } | null {
  for (let day = 1; day <= TOTAL_DAYS; day++) {
    if (!isUnlocked(day, now)) return { day, at: unlockAt(day) };
  }
  return null;
}

export function unlockedCount(now: number): number {
  const next = nextUnlock(now);
  return next ? next.day - 1 : TOTAL_DAYS;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86_400);
  const h = Math.floor((total % 86_400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return `${d}d ${h}h ${pad(m)}m`;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/**
 * Preview helper: add ?date=2026-12-05 (or ?date=2026-12-05T08:30) to the URL
 * to pretend it's that moment in Bucharest. This only changes what the page
 * shows; the server will enforce real unlock times once Supabase is wired up.
 */
const clockOffset = (() => {
  const param = new URLSearchParams(window.location.search).get('date');
  if (!param) return 0;
  const iso = param.length === 10 ? `${param}T00:00:01` : param;
  const target = new Date(`${iso}+02:00`).getTime();
  return Number.isNaN(target) ? 0 : target - Date.now();
})();

export const now = () => Date.now() + clockOffset;
