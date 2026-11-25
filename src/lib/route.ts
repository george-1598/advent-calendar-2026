import { useEffect, useState } from 'react';

/**
 * Tiny hash router (works on GitHub Pages without server rewrites):
 *   #/          → the calendar
 *   #/day/7     → the page for December 7
 */
export type Route = { name: 'home' } | { name: 'day'; day: number };

const ROUTE_EVENT = 'advent-route';
const COLOR_KEY = 'advent-day-color';

export function parseRoute(hash = window.location.hash): Route {
  const m = hash.match(/^#\/day\/(\d{1,2})$/);
  if (m) {
    const day = Number(m[1]);
    if (day >= 1 && day <= 25) return { name: 'day', day };
  }
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
