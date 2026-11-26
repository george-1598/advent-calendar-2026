-- One badge phrase per calendar instead of a letter per day.
--
-- The creator writes a phrase of up to 25 characters (spaces don't count; an
-- emoji counts as one), padded with a filler to exactly 25. Each calendar has a
-- fixed random order (badge_order) deciding which day gives which character, so
-- the badges arrive scrambled. With all 25, players unscramble them (the badge
-- game) to reveal the phrase and the finale. Editing the phrase updates every
-- badge, since badges are looked up live.

alter table public.calendars
  add column if not exists badge_phrase text check (length(badge_phrase) <= 200),
  add column if not exists badge_filler text check (length(badge_filler) <= 16),
  add column if not exists badge_chars text[],
  add column if not exists badge_layout int[],
  add column if not exists badge_order int[];

create table if not exists public.badge_games (
  user_id uuid not null references auth.users (id) on delete cascade,
  calendar_id uuid not null references public.calendars (id) on delete cascade,
  attempts int not null default 0,
  last_attempt_at timestamptz,
  solved_at timestamptz,
  primary key (user_id, calendar_id)
);
alter table public.badge_games enable row level security;

-- The character a day gives (falls back to an old per-day letter when there's no phrase).
create or replace function public.day_badge(p_cal uuid, p_day int, p_fallback text default null)
returns text language sql stable security definer set search_path = ''
as $$
  select case when c.badge_chars is not null and c.badge_order is not null
    then c.badge_chars[c.badge_order[p_day]] else p_fallback end
  from public.calendars c where c.id = p_cal
$$;
revoke execute on function public.day_badge(uuid, int, text) from public, anon, authenticated;

-- p_chars: exactly 25 characters (graphemes, split by the editor), p_layout: word lengths summing to 25.
create or replace function public.set_badge_phrase(p_calendar uuid, p_phrase text, p_filler text, p_chars text[], p_layout int[])
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.can_edit(p_calendar) then
    raise exception 'Only this calendar''s creator can do that';
  end if;
  if p_chars is null then
    update public.calendars set badge_phrase = null, badge_filler = null, badge_chars = null, badge_layout = null where id = p_calendar;
    return;
  end if;
  if coalesce(array_length(p_chars, 1), 0) <> 25
     or exists (select 1 from unnest(p_chars) c where c is null or length(c) not between 1 and 16 or c ~ '\s') then
    raise exception 'The phrase needs exactly 25 characters (with the filler)';
  end if;
  if coalesce((select sum(x) from unnest(p_layout) x), 0) <> 25 or exists (select 1 from unnest(p_layout) x where x < 1) then
    raise exception 'Something is off with the phrase''s words';
  end if;
  if coalesce(trim(p_phrase), '') = '' or length(p_phrase) > 200 then
    raise exception 'Write a phrase';
  end if;
  update public.calendars set
    badge_phrase = trim(p_phrase),
    badge_filler = p_filler,
    badge_chars = p_chars,
    badge_layout = p_layout,
    -- Fixed once: which day gives which character.
    badge_order = coalesce(badge_order, (select array_agg(i order by random()) from generate_series(1, 25) i))
  where id = p_calendar;
end
$$;

create or replace function public.editor_badge(p_calendar uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.can_edit(p_calendar) then
    raise exception 'Only this calendar''s creator can do that';
  end if;
  return (select jsonb_build_object('phrase', badge_phrase, 'filler', badge_filler, 'chars', badge_chars,
                                    'by_day', case when badge_chars is not null then
                                      (select jsonb_agg(badge_chars[badge_order[d]] order by d) from generate_series(1, 25) d) end)
          from public.calendars where id = p_calendar);
end
$$;

-- The player's collected characters and the game's state. Days the creator never
-- filled in give their character for free once they open.
create or replace function public.get_badge_game(p_calendar uuid default '00000000-0000-0000-0000-000000000001')
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  c public.calendars;
  g public.badge_games;
  v_tiles jsonb;
  v_count int;
begin
  if not public.can_play(p_calendar) then
    return null;
  end if;
  select * into c from public.calendars where id = p_calendar;
  if c.badge_chars is null then
    return jsonb_build_object('has_phrase', false);
  end if;
  select * into g from public.badge_games where user_id = v_uid and calendar_id = p_calendar;
  select coalesce(jsonb_agg(jsonb_build_object('day', d, 'char', c.badge_chars[c.badge_order[d]]) order by d), '[]'::jsonb), count(*)
    into v_tiles, v_count
    from generate_series(1, 25) d
    where exists (select 1 from public.progress p where p.user_id = v_uid and p.calendar_id = p_calendar and p.day = d and p.solved_at is not null)
       or (now() >= public.unlock_at(d) and not exists (select 1 from public.effective_quest(v_uid, d, p_calendar)));
  return jsonb_build_object(
    'has_phrase', true,
    'layout', to_jsonb(c.badge_layout),
    'tiles', v_tiles,
    'complete', v_count = 25,
    'attempts', coalesce(g.attempts, 0),
    'solved_at', g.solved_at,
    'answer', case when g.solved_at is not null then to_jsonb(c.badge_chars) end,
    'phrase', case when g.solved_at is not null then public.personalize(c.badge_phrase, v_uid) end,
    'message', case when g.solved_at is not null then public.personalize(c.finale_message, v_uid) end,
    'from', (select pr.display_name from public.profiles pr where pr.id = c.owner_id));
end
$$;

-- p_guess: the 25 tiles in slot order. Case doesn't matter.
create or replace function public.solve_badge_game(p_calendar uuid, p_guess text[])
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  c public.calendars;
  g public.badge_games;
  v_right int;
begin
  if not public.can_play(p_calendar) then
    raise exception 'You don''t have access to this calendar';
  end if;
  select * into c from public.calendars where id = p_calendar;
  if c.badge_chars is null then
    raise exception 'This calendar has no badge phrase yet';
  end if;
  if not coalesce((public.get_badge_game(p_calendar) ->> 'complete')::boolean, false) then
    raise exception 'Collect all 25 badges first';
  end if;
  insert into public.badge_games (user_id, calendar_id) values (v_uid, p_calendar) on conflict do nothing;
  select * into g from public.badge_games where user_id = v_uid and calendar_id = p_calendar for update;
  if g.solved_at is null then
    if g.last_attempt_at > now() - interval '2 seconds' then
      raise exception 'Slow down a little, then try again';
    end if;
    select count(*) into v_right from generate_series(1, 25) i where lower(p_guess[i]) = lower(c.badge_chars[i]);
    update public.badge_games set
      attempts = attempts + case when v_right = 25 then 0 else 1 end,
      last_attempt_at = now(),
      solved_at = case when v_right = 25 then now() end
    where user_id = v_uid and calendar_id = p_calendar;
    if v_right < 25 then
      return jsonb_build_object('correct', false, 'right', v_right);
    end if;
  end if;
  return public.get_badge_game(p_calendar) || jsonb_build_object('correct', true);
end
$$;

-- Badges now come from the phrase.
create or replace function public.submit_answer(p_day int, p_answer text, p_calendar uuid default '00000000-0000-0000-0000-000000000001')
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  e record;
  part record;
  v_progress public.progress;
  v_res jsonb;
  v_step_ok boolean;
  v_solved boolean;
  v_next int;
begin
  if v_uid is null then
    raise exception 'Please sign in first';
  end if;
  if not public.can_play(p_calendar) then
    raise exception 'You don''t have access to this calendar';
  end if;
  if not public.day_open(p_calendar, p_day) then
    raise exception 'This day is still locked';
  end if;

  select * into e from public.effective_quest(v_uid, p_day, p_calendar);
  if not found or coalesce(array_length(e.answers, 1), 0) = 0 then
    raise exception 'This quest isn''t ready yet';
  end if;

  insert into public.progress (user_id, calendar_id, day) values (v_uid, p_calendar, p_day) on conflict do nothing;
  select * into v_progress from public.progress
    where user_id = v_uid and calendar_id = p_calendar and day = p_day
    for update;

  if v_progress.solved_at is not null then
    v_res := jsonb_build_object('correct', true);
    v_solved := true;
  else
    if v_progress.last_attempt_at > now() - interval '2 seconds' then
      raise exception 'Slow down a little, then try again';
    end if;

    select * into part from public.quest_part(v_uid, p_day, v_progress.chain_step, p_calendar);
    v_res := public.check_answer(part.kind, part.answers, p_answer);
    v_step_ok := (v_res ->> 'correct')::boolean;
    v_next := v_progress.chain_step + case when v_step_ok then 1 else 0 end;
    v_solved := v_step_ok and v_next >= coalesce(part.steps, 1);

    insert into public.guess_log (user_id, calendar_id, day, guess, correct)
      values (v_uid, p_calendar, p_day,
              left(case when e.kind = 'chain' then format('[step %s] %s', v_progress.chain_step + 1, coalesce(p_answer, '')) else coalesce(p_answer, '') end, 200),
              v_step_ok);

    update public.progress
      set attempts = attempts + case when v_step_ok then 0 else 1 end,
          last_attempt_at = now(),
          chain_step = case when v_solved then chain_step else v_next end,
          solved_at = case when v_solved then now() end
      where user_id = v_uid and calendar_id = p_calendar and day = p_day
      returning * into v_progress;
  end if;

  return v_res || jsonb_build_object(
    'solved', v_solved,
    'chain_step', v_progress.chain_step,
    'attempts', v_progress.attempts,
    'solved_at', v_progress.solved_at,
    'gave_up', v_progress.gave_up,
    'reward', case when v_solved then public.personalize(e.reward, v_uid) end,
    'hint', case when not v_solved then public.personalize(public.unlocked_hints(e.hint, v_progress.attempts), v_uid) end,
    'hint_count', public.hint_count(e.hint),
    'badge_letter', case when v_solved then public.day_badge(p_calendar, p_day, e.badge_letter) end,
    'answer', case when v_progress.gave_up then public.revealed_answer(e.kind, e.answers) end
  );
end
$$;

create or replace function public.get_my_progress(p_calendar uuid default '00000000-0000-0000-0000-000000000001')
returns table (day int, attempts int, solved_at timestamptz, reward text, hint text, badge_letter text, chain_step int,
               gave_up boolean, hint_count int, answer text)
language sql stable security definer set search_path = ''
as $$
  select
    p.day,
    p.attempts,
    p.solved_at,
    case when p.solved_at is not null then public.personalize(e.reward, p.user_id) end,
    case when p.solved_at is null then public.personalize(public.unlocked_hints(e.hint, p.attempts), p.user_id) end,
    case when p.solved_at is not null then public.day_badge(p.calendar_id, p.day, e.badge_letter) end,
    p.chain_step,
    p.gave_up,
    public.hint_count(e.hint),
    case when p.gave_up then public.revealed_answer(e.kind, e.answers) end
  from public.progress p
  left join lateral public.effective_quest(p.user_id, p.day, p.calendar_id) e on true
  where p.user_id = auth.uid() and p.calendar_id = p_calendar
$$;

create or replace function public.give_up(p_day int, p_calendar uuid default '00000000-0000-0000-0000-000000000001')
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  e record;
  v_progress public.progress;
begin
  if not public.can_play(p_calendar) or not public.day_open(p_calendar, p_day) then
    raise exception 'This day is still locked';
  end if;
  select * into e from public.effective_quest(v_uid, p_day, p_calendar);
  if not found then
    raise exception 'This quest isn''t ready yet';
  end if;
  select * into v_progress from public.progress
    where user_id = v_uid and calendar_id = p_calendar and day = p_day for update;
  if v_progress.solved_at is null then
    if coalesce(v_progress.attempts, 0) < 10 then
      raise exception 'Keep trying a little longer (giving up unlocks after 10 wrong tries)';
    end if;
    update public.progress set solved_at = now(), gave_up = true
      where user_id = v_uid and calendar_id = p_calendar and day = p_day
      returning * into v_progress;
    insert into public.guess_log (user_id, calendar_id, day, guess, correct)
      values (v_uid, p_calendar, p_day, '[gave up]', false);
  end if;
  return jsonb_build_object(
    'correct', true, 'solved', true,
    'chain_step', v_progress.chain_step,
    'attempts', v_progress.attempts,
    'solved_at', v_progress.solved_at,
    'gave_up', v_progress.gave_up,
    'reward', public.personalize(e.reward, v_uid),
    'hint', null,
    'hint_count', public.hint_count(e.hint),
    'badge_letter', public.day_badge(p_calendar, p_day, e.badge_letter),
    'answer', case when v_progress.gave_up then public.revealed_answer(e.kind, e.answers) end);
end
$$;

create or replace function public.my_wrapped(p_calendar uuid default '00000000-0000-0000-0000-000000000001')
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if not public.can_play(p_calendar) then
    return null;
  end if;
  return (
    with mine as (
      select p.*, e.kind, public.day_badge(p.calendar_id, p.day, e.badge_letter) as letter
      from public.progress p
      left join lateral public.effective_quest(p.user_id, p.day, p.calendar_id) e on true
      where p.user_id = v_uid and p.calendar_id = p_calendar
    )
    select jsonb_build_object(
      'name', public.first_name(v_uid),
      'total', (select count(*) from generate_series(1, 25) d where exists (select 1 from public.effective_quest(v_uid, d, p_calendar))),
      'solved', (select count(*) from mine where solved_at is not null and not gave_up),
      'revealed', (select count(*) from mine where gave_up),
      'first_try', (select count(*) from mine where solved_at is not null and not gave_up and attempts = 0),
      'wrong_total', (select coalesce(sum(attempts), 0) from mine),
      'toughest', (select jsonb_build_object('day', day, 'attempts', attempts) from mine where attempts > 0 order by attempts desc, day limit 1),
      'fastest', (select jsonb_build_object('day', day, 'seconds', round(extract(epoch from solved_at - public.unlock_at(day)))) from mine
                  where solved_at is not null and not gave_up and solved_at >= public.unlock_at(day)
                  order by solved_at - public.unlock_at(day) limit 1),
      'night_owl', (select count(*) from mine where solved_at is not null and extract(hour from solved_at at time zone 'Europe/Bucharest') < 6),
      'favourite_kind', (select kind from mine where solved_at is not null and kind is not null group by kind order by count(*) desc, min(day) limit 1),
      'letters', (select string_agg(coalesce(letter, '★'), '' order by day) from mine where solved_at is not null),
      'thanks_sent', (select count(*) from public.calendar_notes n where n.calendar_id = p_calendar and n.kind = 'thanks' and n.from_user = v_uid),
      'hints_received', (select count(*) from public.calendar_notes n where n.calendar_id = p_calendar and n.kind = 'hint' and n.to_user = v_uid))
  );
end
$$;

create or replace function public.get_finale(p_calendar uuid default '00000000-0000-0000-0000-000000000001')
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_quest_days int;
  v_done int;
  v_open boolean;
begin
  if not public.can_play(p_calendar) then
    return null;
  end if;
  select count(*) into v_quest_days
    from generate_series(1, 25) d where exists (select 1 from public.effective_quest(v_uid, d, p_calendar));
  select count(*) into v_done
    from public.progress p
    where p.user_id = v_uid and p.calendar_id = p_calendar and p.solved_at is not null
      and exists (select 1 from public.effective_quest(v_uid, p.day, p_calendar));
  if exists (select 1 from public.calendars where id = p_calendar and badge_chars is not null) then
    -- With a badge phrase, the finale comes with solving the badge game.
    v_open := exists (select 1 from public.badge_games g where g.user_id = v_uid and g.calendar_id = p_calendar and g.solved_at is not null);
  else
    v_open := v_quest_days > 0 and v_done >= v_quest_days and (v_done >= 25 or now() >= public.unlock_at(24));
  end if;
  return jsonb_build_object(
    'unlocked', v_open,
    'done', v_done,
    'total', v_quest_days,
    'message', case when v_open then public.personalize((select finale_message from public.calendars where id = p_calendar), v_uid) end,
    'from', (select pr.display_name from public.calendars c join public.profiles pr on pr.id = c.owner_id where c.id = p_calendar));
end
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'set_badge_phrase(uuid, text, text, text[], int[])', 'editor_badge(uuid)', 'get_badge_game(uuid)',
    'solve_badge_game(uuid, text[])', 'get_finale(uuid)', 'submit_answer(int, text, uuid)',
    'get_my_progress(uuid)', 'give_up(int, uuid)', 'my_wrapped(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end
$$;
