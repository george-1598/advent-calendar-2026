-- Name placeholders, a hint ladder, giving up, a finale message and Christmas Wrapped.
--
--  * "{name}" in a quest's title/content, gift or hint becomes the player's first name.
--  * The hint field can hold up to 3 lines: line 1 unlocks after 3 wrong tries,
--    line 2 after 6, line 3 after 9.
--  * After 10 wrong tries a player may give up: the day counts as done (grey badge),
--    and the answer is revealed for word games.
--  * Each calendar can have a finale message, shown once every filled-in day is done.

alter table public.progress add column if not exists gave_up boolean not null default false;
alter table public.calendars add column if not exists finale_message text check (length(finale_message) <= 1000);

create or replace function public.first_name(p_user uuid)
returns text language sql stable security definer set search_path = ''
as $$ select coalesce(nullif(split_part(trim(display_name), ' ', 1), ''), 'friend') from public.profiles where id = p_user $$;

create or replace function public.personalize(p_text text, p_user uuid)
returns text language sql stable security definer set search_path = ''
as $$
  select case when p_text is null or position('{name}' in p_text) = 0 then p_text
    else replace(p_text, '{name}', coalesce(public.first_name(p_user), 'friend')) end
$$;

create or replace function public.personalize_json(p jsonb, p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_name text;
begin
  if p is null or position('{name}' in p::text) = 0 then
    return p;
  end if;
  -- JSON-escape the name (drop the surrounding quotes) so the document stays valid.
  v_name := to_jsonb(coalesce(public.first_name(p_user), 'friend'))::text;
  v_name := substr(v_name, 2, length(v_name) - 2);
  return replace(p::text, '{name}', v_name)::jsonb;
end
$$;

-- The hint lines unlocked so far (one per 3 wrong tries), joined by newlines.
create or replace function public.unlocked_hints(p_hint text, p_attempts int)
returns text language sql immutable set search_path = ''
as $$
  select nullif(array_to_string((array(
    select l from unnest(string_to_array(coalesce(p_hint, ''), E'\n')) with ordinality as t(l, i)
    where trim(l) <> '' order by i))[1:least(3, greatest(0, p_attempts / 3))], E'\n'), '')
$$;

create or replace function public.hint_count(p_hint text)
returns int language sql immutable set search_path = ''
as $$ select least(3, (select count(*)::int from unnest(string_to_array(coalesce(p_hint, ''), E'\n')) as l where trim(l) <> '')) $$;

-- Answer to show after giving up (only for games with a typed answer).
create or replace function public.revealed_answer(p_kind text, p_answers text[])
returns text language sql immutable set search_path = ''
as $$
  select case when coalesce(p_kind, 'riddle') in ('riddle', 'wordle', 'song', 'anagram', 'treasure', 'morse', 'zoom', 'emoji', 'hangman', 'cipher')
    then p_answers[1] end
$$;

drop function if exists public.get_quest(int, uuid);
create or replace function public.get_quest(p_day int, p_calendar uuid default '00000000-0000-0000-0000-000000000001')
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  e record;
begin
  if not public.day_open(p_calendar, p_day) then
    return null;
  end if;
  select * into e from public.effective_quest(auth.uid(), p_day, p_calendar);
  if not found then
    return null;
  end if;
  return jsonb_build_object('day', p_day, 'title', public.personalize(e.title, auth.uid()), 'kind', e.kind,
                            'content', public.personalize_json(e.content, auth.uid()));
end
$$;


drop function if exists public.submit_answer(int, text, uuid);
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
    'badge_letter', case when v_solved then e.badge_letter end,
    'answer', case when v_progress.gave_up then public.revealed_answer(e.kind, e.answers) end
  );
end
$$;

drop function if exists public.get_my_progress(uuid);
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
    case when p.solved_at is not null then e.badge_letter end,
    p.chain_step,
    p.gave_up,
    public.hint_count(e.hint),
    case when p.gave_up then public.revealed_answer(e.kind, e.answers) end
  from public.progress p
  left join lateral public.effective_quest(p.user_id, p.day, p.calendar_id) e on true
  where p.user_id = auth.uid() and p.calendar_id = p_calendar
$$;

-- Give up on a day after 10 wrong tries: it counts as done, with a grey badge.
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
    'badge_letter', e.badge_letter,
    'answer', case when v_progress.gave_up then public.revealed_answer(e.kind, e.answers) end);
end
$$;

-- ---------------------------------------------------------------- finale

create or replace function public.set_finale(p_calendar uuid, p_message text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.can_edit(p_calendar) then
    raise exception 'Only this calendar''s creator can do that';
  end if;
  if length(coalesce(p_message, '')) > 1000 then
    raise exception 'Keep the finale under 1000 characters';
  end if;
  update public.calendars set finale_message = nullif(trim(p_message), '') where id = p_calendar;
end
$$;

create or replace function public.editor_finale(p_calendar uuid)
returns text
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.can_edit(p_calendar) then
    raise exception 'Only this calendar''s creator can do that';
  end if;
  return (select finale_message from public.calendars where id = p_calendar);
end
$$;

-- Unlocked once every filled-in day is done and either all 25 are done or it's Dec 24+.
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
  v_open := v_quest_days > 0 and v_done >= v_quest_days and (v_done >= 25 or now() >= public.unlock_at(24));
  return jsonb_build_object(
    'unlocked', v_open,
    'done', v_done,
    'total', v_quest_days,
    'message', case when v_open then public.personalize((select finale_message from public.calendars where id = p_calendar), v_uid) end,
    'from', (select pr.display_name from public.calendars c join public.profiles pr on pr.id = c.owner_id where c.id = p_calendar));
end
$$;

-- ---------------------------------------------------------------- Christmas Wrapped

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
      select p.*, e.kind, e.badge_letter as letter
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

-- Dashboard and activity now include whether a day was given up.
create or replace function public.admin_dashboard(p_calendar uuid default '00000000-0000-0000-0000-000000000001')
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_main boolean := p_calendar = public.main_calendar();
begin
  if not public.can_edit(p_calendar) then
    raise exception 'Only this calendar''s creator can do that';
  end if;
  return coalesce((
    select jsonb_agg(x.u order by x.created_at)
    from (
      select au.created_at, jsonb_build_object(
        'id', p.id,
        'name', p.display_name,
        'email', case when v_main then au.email end,
        'is_admin', v_main and p.is_admin,
        'created_at', au.created_at,
        'last_seen_at', p.last_seen_at,
        'current_theme', p.current_theme,
        'progress', coalesce((
          select jsonb_agg(jsonb_build_object('day', pr.day, 'attempts', pr.attempts, 'solved_at', pr.solved_at, 'gave_up', pr.gave_up) order by pr.day)
          from public.progress pr where pr.user_id = p.id and pr.calendar_id = p_calendar), '[]'::jsonb),
        'unlocks', case when v_main then coalesce((
          select jsonb_agg(jsonb_build_object('theme', t.theme, 'unlocked_at', t.unlocked_at, 'attempts', t.attempts, 'started_at', t.hunt_started_at) order by t.unlocked_at)
          from public.theme_unlocks t where t.user_id = p.id), '[]'::jsonb) else '[]'::jsonb end,
        'guesses', coalesce((
          select jsonb_agg(jsonb_build_object('day', g.day, 'guess', g.guess, 'correct', g.correct, 'at', g.created_at) order by g.created_at desc)
          from (select * from public.guess_log gl where gl.user_id = p.id and gl.calendar_id = p_calendar order by gl.created_at desc limit 60) g), '[]'::jsonb)
      ) as u
      from public.profiles p
      join auth.users au on au.id = p.id
      where v_main or exists (select 1 from public.calendar_members m where m.calendar_id = p_calendar and m.user_id = p.id)
    ) x
  ), '[]'::jsonb);
end
$$;

create or replace function public.calendar_activity(p_calendar uuid default '00000000-0000-0000-0000-000000000001')
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.can_edit(p_calendar) then
    raise exception 'Only this calendar''s creator can do that';
  end if;
  -- Thank-yous are read once the creator has seen the feed.
  return jsonb_build_object(
    'events', coalesce((
      select jsonb_agg(e order by (e ->> 'at') desc)
      from (
        select * from (
          select jsonb_build_object('type', 'solved', 'user_id', pr.user_id, 'name', p.display_name, 'day', pr.day,
                                    'attempts', pr.attempts, 'gave_up', pr.gave_up, 'at', pr.solved_at) as e
          from public.progress pr join public.profiles p on p.id = pr.user_id
          where pr.calendar_id = p_calendar and pr.solved_at is not null
          union all
          select jsonb_build_object('type', 'joined', 'user_id', m.user_id, 'name', p.display_name, 'at', m.joined_at)
          from public.calendar_members m join public.profiles p on p.id = m.user_id
          where m.calendar_id = p_calendar
          union all
          select jsonb_build_object('type', n.kind, 'user_id', case when n.kind = 'hint' then n.to_user else n.from_user end,
                                    'name', p.display_name, 'day', n.day, 'emoji', n.emoji, 'body', n.body,
                                    'at', n.created_at, 'unread', n.kind = 'thanks' and n.read_at is null)
          from public.calendar_notes n
          join public.profiles p on p.id = case when n.kind = 'hint' then n.to_user else n.from_user end
          where n.calendar_id = p_calendar
        ) all_events
        order by (e ->> 'at') desc
        limit 60
      ) recent), '[]'::jsonb),
    -- Open days a player has tried 3+ times without solving.
    'stuck', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', pr.user_id, 'name', p.display_name, 'day', pr.day,
                                          'attempts', pr.attempts, 'last_attempt_at', pr.last_attempt_at,
                                          'hints_sent', (select count(*) from public.calendar_notes n
                                                         where n.calendar_id = p_calendar and n.kind = 'hint'
                                                           and n.to_user = pr.user_id and n.day = pr.day))
                       order by pr.last_attempt_at desc)
      from public.progress pr join public.profiles p on p.id = pr.user_id
      where pr.calendar_id = p_calendar and pr.solved_at is null and pr.attempts >= 3), '[]'::jsonb)
  );
end
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'get_quest(int, uuid)', 'submit_answer(int, text, uuid)', 'get_my_progress(uuid)', 'give_up(int, uuid)',
    'set_finale(uuid, text)', 'editor_finale(uuid)', 'get_finale(uuid)', 'my_wrapped(uuid)',
    'admin_dashboard(uuid)', 'calendar_activity(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end
$$;
revoke execute on function public.first_name(uuid) from public, anon, authenticated;
revoke execute on function public.personalize(text, uuid) from public, anon, authenticated;
revoke execute on function public.personalize_json(jsonb, uuid) from public, anon, authenticated;
