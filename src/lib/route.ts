import { useEffect, useState } from 'react';

/**
 * Tiny hash router (works on GitHub Pages without server rewrites):
 *   #/          → the calendar
 *   #/day/7     → the page for December 7
 *   #/admin/…   → the organiser's pages
 *   #/mine/…    → the user's own calendar for friends
 *   #/c/<id>/…  → any of the above, switching to calendar <id> first (treasure QR codes)
 */
export type AdminTab = 'players' | 'activity' | 'quests' | 'health';
export type MineTab = 'friends' | 'activity' | 'quests' | 'players';
export type Route = (
  | { name: 'home' }
  | { name: 'day'; day: number; code?: string }
  | { name: 'admin'; tab: AdminTab }
  | { name: 'mine'; tab: MineTab }
  | { name: 'join'; token: string }
  | { name: 'profile' }
) & { calendar?: string };

const ROUTE_EVENT = 'advent-route';
const COLOR_KEY = 'advent-day-color';

export function parseRoute(hash = window.location.hash): Route {
  const c = hash.match(/^#\/c\/([0-9a-f-]{36})(\/.*)?$/);
  if (c) return { ...parseRoute(`#${c[2] ?? '/'}`), calendar: c[1] };
  // #/day/7 or #/day/7/CODE (treasure-hunt QR codes carry the code).
  const m = hash.match(/^#\/day\/(\d{1,2})(?:\/([^/?#]+))?$/);
  if (m) {
    const day = Number(m[1]);
    if (day >= 1 && day <= 25) return { name: 'day', day, code: m[2] ? decodeURIComponent(m[2]) : undefined };
  }
  const a = hash.match(/^#\/admin(?:\/(players|activity|quests|health))?$/);
  if (a) return { name: 'admin', tab: (a[1] as AdminTab | undefined) ?? 'players' };
  const mine = hash.match(/^#\/mine(?:\/(friends|activity|quests|players))?$/);
  if (mine) return { name: 'mine', tab: (mine[1] as MineTab | undefined) ?? 'friends' };
  if (hash === '#/profile') return { name: 'profile' };
  const join = hash.match(/^#\/join\/([a-f0-9]{16,64})$/);
  if (join) return { name: 'join', token: join[1] };
  return { name: 'home' };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(parseRoute);
  useEffect(() => {
    const update = () => setRoute(parseRoute());
    window.addEventListener('popstate', update);
    window.addEventListener('hashchange', update);
    window.addEventListener(ROUTE_EVENT, update);
    return () => {
      window.removeEventListener('popstate', update);
      window.removeEventListener('hashchange', update);
      window.removeEventListener(ROUTE_EVENT, update);
    };
  }, []);
  return route;
}

interface HistoryState {
  /** The day page was opened from the calendar, so "back" can use history. */
  fromCalendar?: boolean;
  /** Calendar scroll position to restore on return. */
  scrollY?: number;
}

/** Open a day's page. `color` tints its header (the tile/gift/drawer that was tapped). */
export function openDayPage(day: number, color?: string) {
  try {
    if (color) sessionStorage.setItem(COLOR_KEY, color);
  } catch {
    // ignore
  }
  const fromHome = parseRoute().name === 'home';
  const state: HistoryState = { fromCalendar: fromHome || (history.state as HistoryState | null)?.fromCalendar };
  if (fromHome) {
    // Remember where the calendar was scrolled to.
    history.replaceState({ ...(history.state ?? {}), scrollY: window.scrollY }, '');
  }
  // Moving between days replaces the entry, so "back" always returns to the calendar.
  if (fromHome) history.pushState(state, '', `#/day/${day}`);
  else history.replaceState(state, '', `#/day/${day}`);
  window.dispatchEvent(new Event(ROUTE_EVENT));
  window.scrollTo(0, 0);
}

export function dayColor(): string | null {
  try {
    return sessionStorage.getItem(COLOR_KEY);
  } catch {
    return null;
  }
}

/** Back to the calendar: real history back when we came from it, else a fresh entry. */
export function goHome() {
  if ((history.state as HistoryState | null)?.fromCalendar) {
    history.back();
    return;
  }
  history.pushState({}, '', '#/');
  window.dispatchEvent(new Event(ROUTE_EVENT));
}

export function savedScroll(): number | null {
  const y = (history.state as HistoryState | null)?.scrollY;
  return typeof y === 'number' ? y : null;
}

/** Open an admin tab (replaces the entry when switching tabs). */
export function openAdmin(tab: AdminTab = 'players') {
  const inAdmin = parseRoute().name === 'admin';
  if (inAdmin) history.replaceState({}, '', `#/admin/${tab}`);
  else history.pushState({}, '', `#/admin/${tab}`);
  window.dispatchEvent(new Event(ROUTE_EVENT));
  window.scrollTo(0, 0);
}

/** Open a tab of the user's own calendar page. */
export function openMine(tab: MineTab = 'friends') {
  const inMine = parseRoute().name === 'mine';
  if (inMine) history.replaceState({}, '', `#/mine/${tab}`);
  else history.pushState({}, '', `#/mine/${tab}`);
  window.dispatchEvent(new Event(ROUTE_EVENT));
  window.scrollTo(0, 0);
}

/** Drop a "#/c/<id>" prefix once the calendar has been selected. */
export function stripCalendarFromUrl() {
  const m = window.location.hash.match(/^#\/c\/[0-9a-f-]{36}(\/.*)?$/);
  if (!m) return;
  history.replaceState(history.state, '', `#${m[1] ?? '/'}`);
  window.dispatchEvent(new Event(ROUTE_EVENT));
}

/** The link a friend opens to join a calendar. */
export function inviteUrl(token: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}#/join/${token}`;
}

/** Open the profile page (display name & password). */
export function openProfile() {
  history.pushState({}, '', '#/profile');
  window.dispatchEvent(new Event(ROUTE_EVENT));
  window.scrollTo(0, 0);
}
