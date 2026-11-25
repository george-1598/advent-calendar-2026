import { createClient } from '@supabase/supabase-js';

// Both values are public by design: the anon key can only do what the
// database's row-level security and functions allow (see supabase/migrations).
const SUPABASE_URL = 'https://bqxkqiugvsclczhnszlp.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxeGtxaXVndnNjbGN6aG5zemxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU2MzM5ODAsImV4cCI6MjExMTIwOTk4MH0.5XF4fAKd4gbQnUvxDQxTgh-gTRNM90VJrSgr9RFoFnQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
