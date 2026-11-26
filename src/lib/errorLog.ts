import { supabase } from './supabase';

type Kind = 'crash' | 'error' | 'promise' | 'network' | 'server';

const sent = new Set<string>();
const MAX_PER_SESSION = 20;

/** Send an error to the admin's error log (each message once per session, quietly). */
export function logError(kind: Kind, message: string, detail?: string) {
  if (import.meta.env.DEV) console.warn('[error log]', kind, message, detail ?? '');
  const key = `${kind}:${message}`;
  if (sent.has(key) || sent.size >= MAX_PER_SESSION) return;
  sent.add(key);
  // Deferred so it never runs during module setup (supabase.ts imports this file).
  window.setTimeout(() => {
    supabase
      .rpc('log_client_error', {
        p_kind: kind,
        p_message: message.slice(0, 500),
        p_detail: detail?.slice(0, 4000) ?? null,
        p_url: window.location.href.replace(/access_token=[^&]+/, 'access_token=…').slice(0, 500),
        p_user_agent: navigator.userAgent.slice(0, 300),
      })
      .then(
        () => undefined,
        () => undefined,
      );
  }, 0);
}

/** Catch uncaught errors and rejected promises anywhere in the app. */
export function installErrorHandlers() {
  window.addEventListener('error', (e) => {
    // Ignore noise from browser extensions and cross-origin scripts.
    if (!e.message || e.message === 'Script error.') return;
    logError('error', e.message, [e.filename && `${e.filename}:${e.lineno}:${e.colno}`, e.error?.stack].filter(Boolean).join('\n'));
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    const message = r instanceof Error ? r.message : typeof r === 'string' ? r : JSON.stringify(r)?.slice(0, 300) ?? 'Unknown';
    // Failed fetches are already reported by the network wrapper.
    if (/Failed to fetch|NetworkError|Load failed/i.test(message)) return;
    logError('promise', message, r instanceof Error ? r.stack : undefined);
  });
}
