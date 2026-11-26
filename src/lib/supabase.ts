import { createClient } from '@supabase/supabase-js';
import { logError } from './errorLog';

// Both values are public by design: the anon key can only do what the
// database's row-level security and functions allow (see supabase/migrations).
const SUPABASE_URL = 'https://bqxkqiugvsclczhnszlp.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxeGtxaXVndnNjbGN6aG5zemxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU2MzM5ODAsImV4cCI6MjExMTIwOTk4MH0.5XF4fAKd4gbQnUvxDQxTgh-gTRNM90VJrSgr9RFoFnQ';

/** Reports server failures (5xx) and dropped connections to the error log. */
const reportingFetch: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const what = url.replace(SUPABASE_URL, '').split('?')[0];
  const quiet = what.includes('log_client_error');
  try {
    const res = await fetch(input, init);
    if (res.status >= 500 && !quiet) logError('server', `Server error ${res.status} on ${what}`);
    return res;
  } catch (err) {
    if (!quiet && navigator.onLine !== false) logError('network', `Couldn’t reach the server (${what})`, err instanceof Error ? err.message : String(err));
    throw err;
  }
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { fetch: reportingFetch } });
