-- The four suspects: the answer is the culprit's position ("0"–"3"), checked as
-- text like a riddle. After giving up it's revealed (the app shows the name).
create or replace function public.revealed_answer(p_kind text, p_answers text[])
returns text language sql immutable set search_path = ''
as $$
  select case when coalesce(p_kind, 'riddle') in ('riddle', 'wordle', 'song', 'anagram', 'treasure', 'morse', 'zoom', 'emoji', 'hangman', 'cipher', 'suspects')
    then p_answers[1] end
$$;
