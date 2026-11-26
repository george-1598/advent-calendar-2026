-- Friend calendars. Anyone can make one calendar and invite up to 3 friends by
-- email. The organiser's calendar is the "main" calendar, which everyone plays.
--
-- Every quest, override, progress row and guess now belongs to a calendar.
-- Functions take p_calendar, defaulting to the main calendar, so older clients
-- keep working. Photos for friend calendars live under "<calendar id>/day-07/…";
-- the main calendar keeps "day-07/…".

-- ---------------------------------------------------------------- tables

create table if not exists public.calendars (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid unique references auth.users (id) on delete cascade,
  title text not null check (length(title) between 1 and 60),
  created_at timestamptz not null default now()
);
alter table public.calendars enable row level security; -- read through functions only

insert into public.calendars (id, owner_id, title)
  values ('00000000-0000-0000-0000-000000000001', null, 'Advent Calendar 2026')
  on conflict (id) do nothing;

create table if not exists public.calendar_members (
  calendar_id uuid not null references public.calendars (id) on delete cascade,
  email text not null check (email = lower(email)),
  added_at timestamptz not null default now(),
  primary key (calendar_id, email)
);
alter table public.calendar_members enable row level security;
create index if not exists calendar_members_email on public.calendar_members (email);

alter table public.quest_secrets drop constraint if exists quest_secrets_day_fkey;

alter table public.quests
  add column if not exists calendar_id uuid not null default '00000000-0000-0000-0000-000000000001'
    references public.calendars (id) on delete cascade;
alter table public.quests drop constraint quests_pkey, add primary key (calendar_id, day);

alter table public.quest_secrets
  add column if not exists calendar_id uuid not null default '00000000-0000-0000-0000-000000000001';
alter table public.quest_secrets drop constraint quest_secrets_pkey, add primary key (calendar_id, day);
alter table public.quest_secrets
  add foreign key (calendar_id, day) references public.quests (calendar_id, day) on delete cascade;

alter table public.quest_overrides
  add column if not exists calendar_id uuid not null default '00000000-0000-0000-0000-000000000001'
    references public.calendars (id) on delete cascade;
alter table public.quest_overrides drop constraint quest_overrides_pkey, add primary key (calendar_id, user_id, day);

alter table public.progress
  add column if not exists calendar_id uuid not null default '00000000-0000-0000-0000-000000000001'
    references public.calendars (id) on delete cascade;
alter table public.progress drop constraint progress_pkey, add primary key (user_id, calendar_id, day);

alter table public.guess_log
  add column if not exists calendar_id uuid not null default '00000000-0000-0000-0000-000000000001'
    references public.calendars (id) on delete cascade;
create index if not exists guess_log_cal_user on public.guess_log (calendar_id, user_id, created_at desc);

-- ---------------------------------------------------------------- access helpers

create or replace function public.main_calendar()
returns uuid language sql immutable set search_path = ''
as $$ select '00000000-0000-0000-0000-000000000001'::uuid $$;

-- The signed-in user's email, only once confirmed (so nobody can claim a friend's invite).
create or replace function public.my_email()
returns text language sql stable security definer set search_path = ''
as $$ select lower(email) from auth.users where id = auth.uid() and email_confirmed_at is not null $$;

create or replace function public.can_edit(p_cal uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select case
    when p_cal = public.main_calendar() then public.is_admin()
    else exists (select 1 from public.calendars c where c.id = p_cal and c.owner_id = auth.uid())
  end
$$;

create or replace function public.can_play(p_cal uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and (
    p_cal = public.main_calendar()
    or public.can_edit(p_cal)
    or exists (select 1 from public.calendar_members m where m.calendar_id = p_cal and m.email = public.my_email()))
$$;

-- A day's content is visible: player has access and it's unlocked (editors see early).
create or replace function public.day_open(p_cal uuid, p_day int)
returns boolean language sql stable security definer set search_path = ''
as $$ select public.can_play(p_cal) and (now() >= public.unlock_at(p_day) or public.can_edit(p_cal)) $$;

-- Is this user one of the calendar's (signed-up) players?
create or replace function public.is_member(p_cal uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select p_cal = public.main_calendar() or exists (
    select 1 from auth.users au
    join public.calendar_members m on m.email = lower(au.email) and m.calendar_id = p_cal
    where au.id = p_user and au.email_confirmed_at is not null)
$$;

drop policy if exists "read unlocked quests" on public.quests;
create policy "read unlocked quests" on public.quests for select to authenticated
  using (public.day_open(calendar_id, day));

-- ---------------------------------------------------------------- quests & answers

drop function if exists public.effective_quest(uuid, int);
create or replace function public.effective_quest(p_user uuid, p_day int, p_calendar uuid default '00000000-0000-0000-0000-000000000001')
returns table (title text, kind text, content jsonb, answers text[], reward text, hint text, badge_letter text)
language sql stable security definer set search_path = ''
as $$
  select
    coalesce(o.title, q.title),
    coalesce(o.kind, q.kind, 'riddle'),
    coalesce(o.content, q.content, '{}'::jsonb),
    coalesce(o.answers, s.answers),
    coalesce(o.reward, s.reward),
    coalesce(o.hint, s.hint),
    coalesce(o.badge_letter, s.badge_letter)
  from (select p_day as day) d
  left join public.quests q on q.calendar_id = p_calendar and q.day = d.day
  left join public.quest_secrets s on s.calendar_id = p_calendar and s.day = d.day
  left join public.quest_overrides o on o.calendar_id = p_calendar and o.day = d.day and o.user_id = p_user
  where coalesce(o.title, q.title) is not null
$$;
revoke execute on function public.effective_quest(uuid, int, uuid) from public, anon, authenticated;

drop function if exists public.quest_part(uuid, int, int);
create or replace function public.quest_part(p_user uuid, p_day int, p_step int, p_calendar uuid default '00000000-0000-0000-0000-000000000001')
returns table (kind text, answers text[], steps int)
language plpgsql stable security definer set search_path = ''
as $$
declare
  e record;
begin
  select * into e from public.effective_quest(p_user, p_day, p_calendar);
  if not found then
    return;
  end if;
  if e.kind = 'chain' then
    return query select
      e.content -> 'parts' -> p_step ->> 'kind',
      array(select jsonb_array_elements_text(coalesce(e.answers[p_step + 1], '[]')::jsonb)),
      jsonb_array_length(coalesce(e.content -> 'parts', '[]'::jsonb));
  else
    return query select e.kind, e.answers, 1;
  end if;
end
$$;
revoke execute on function public.quest_part(uuid, int, int, uuid) from public, anon, authenticated;

drop function if exists public.get_quest(int);
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
  return jsonb_build_object('day', p_day, 'title', e.title, 'kind', e.kind, 'content', e.content);
end
$$;

drop function if exists public.submit_answer(int, text);
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
    'reward', case when v_solved then e.reward end,
    'hint', case when v_solved or v_progress.attempts >= 3 then e.hint end,
    'badge_letter', case when v_solved then e.badge_letter end
  );
end
$$;

drop function if exists public.get_my_progress();
create or replace function public.get_my_progress(p_calendar uuid default '00000000-0000-0000-0000-000000000001')
returns table (day int, attempts int, solved_at timestamptz, reward text, hint text, badge_letter text, chain_step int)
language sql stable security definer set search_path = ''
as $$
  select
    p.day,
    p.attempts,
    p.solved_at,
    case when p.solved_at is not null then e.reward end,
    case when p.solved_at is not null or p.attempts >= 3 then e.hint end,
    case when p.solved_at is not null then e.badge_letter end,
    p.chain_step
  from public.progress p
  left join lateral public.effective_quest(p.user_id, p.day, p.calendar_id) e on true
  where p.user_id = auth.uid() and p.calendar_id = p_calendar
$$;

drop function if exists public.hot_cold_probe(int, float8, float8, int);
create or replace function public.hot_cold_probe(p_day int, p_x float8, p_y float8, p_step int default null, p_calendar uuid default '00000000-0000-0000-0000-000000000001')
returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  part record;
  t_x float8; t_y float8; t_r float8; d float8;
begin
  if not public.day_open(p_calendar, p_day) then
    raise exception 'This day is still locked';
  end if;
  select * into part from public.quest_part(auth.uid(), p_day, coalesce(p_step, 0), p_calendar);
  if not found or part.kind <> 'hotcold' then
    raise exception 'Not a hot & cold game';
  end if;
  t_x := split_part(part.answers[1], ',', 1)::float8;
  t_y := split_part(part.answers[1], ',', 2)::float8;
  t_r := coalesce(nullif(split_part(part.answers[1], ',', 3), '')::float8, 0.06);
  d := sqrt(power(p_x - t_x, 2) + power(p_y - t_y, 2));
  return case
    when d <= t_r then 'found'
    when d <= t_r * 2 then 'boiling'
    when d <= 0.15 then 'hot'
    when d <= 0.28 then 'warm'
    when d <= 0.45 then 'cool'
    else 'cold'
  end;
end
$$;

drop function if exists public.hangman_letter(int, text, int);
create or replace function public.hangman_letter(p_day int, p_letter text, p_step int default null, p_calendar uuid default '00000000-0000-0000-0000-000000000001')
returns int[]
language plpgsql stable security definer set search_path = ''
as $$
declare
  part record;
  w text;
  l text := lower(left(coalesce(p_letter, ''), 1));
  out int[] := '{}';
  i int;
begin
  if not public.day_open(p_calendar, p_day) then
    raise exception 'This day is still locked';
  end if;
  select * into part from public.quest_part(auth.uid(), p_day, coalesce(p_step, 0), p_calendar);
  if not found or part.kind <> 'hangman' then
    raise exception 'Not a hangman game';
  end if;
  w := public.normalize_answer(part.answers[1]);
  for i in 1..length(w) loop
    if substr(w, i, 1) = l then
      out := out || (i - 1);
    end if;
  end loop;
  return out;
end
$$;

-- ---------------------------------------------------------------- editing (admin or calendar owner)

drop function if exists public.admin_quests();
create or replace function public.admin_quests(p_calendar uuid default '00000000-0000-0000-0000-000000000001')
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.can_edit(p_calendar) then
    raise exception 'Only this calendar''s creator can do that';
  end if;
  return (
    select jsonb_agg(jsonb_build_object(
      'day', d,
      'unlock_at', public.unlock_at(d),
      'title', q.title,
      'kind', q.kind,
      'content', q.content,
      'answers', s.answers,
      'reward', s.reward,
      'hint', s.hint,
      'badge_letter', s.badge_letter,
      'solved_by', (select count(*) from public.progress pr where pr.calendar_id = p_calendar and pr.day = d and pr.solved_at is not null),
      'overrides', coalesce((
        select jsonb_agg(jsonb_build_object(
          'user_id', o.user_id, 'title', o.title, 'kind', o.kind, 'content', o.content,
          'answers', o.answers, 'reward', o.reward, 'hint', o.hint, 'badge_letter', o.badge_letter))
        from public.quest_overrides o where o.calendar_id = p_calendar and o.day = d), '[]'::jsonb)
    ) order by d)
    from generate_series(1, 25) as d
    left join public.quests q on q.calendar_id = p_calendar and q.day = d
    left join public.quest_secrets s on s.calendar_id = p_calendar and s.day = d
  );
end
$$;

drop function if exists public.admin_save_quest(int, text, text, jsonb, text[], text, text, text);
create or replace function public.admin_save_quest(
  p_day int, p_title text, p_kind text, p_content jsonb, p_answers text[], p_reward text, p_hint text, p_badge_letter text,
  p_calendar uuid default '00000000-0000-0000-0000-000000000001')
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.can_edit(p_calendar) then
    raise exception 'Only this calendar''s creator can do that';
  end if;
  if p_day not between 1 and 25 then
    raise exception 'Day must be 1–25';
  end if;
  if coalesce(trim(p_title), '') = '' then
    raise exception 'Give the quest a title';
  end if;
  if coalesce(array_length(array_remove(p_answers, ''), 1), 0) = 0 then
    raise exception 'Add at least one accepted answer';
  end if;
  if coalesce(trim(p_reward), '') = '' then
    raise exception 'Describe the gift / surprise';
  end if;

  insert into public.quests (calendar_id, day, title, kind, content)
    values (p_calendar, p_day, trim(p_title), coalesce(nullif(p_kind, ''), 'riddle'), coalesce(p_content, '{}'::jsonb))
    on conflict (calendar_id, day) do update set title = excluded.title, kind = excluded.kind, content = excluded.content;

  insert into public.quest_secrets (calendar_id, day, answers, reward, hint, badge_letter)
    values (p_calendar, p_day, array_remove(p_answers, ''), p_reward, nullif(trim(p_hint), ''), nullif(trim(p_badge_letter), ''))
    on conflict (calendar_id, day) do update set
      answers = excluded.answers, reward = excluded.reward, hint = excluded.hint, badge_letter = excluded.badge_letter;
end
$$;

drop function if exists public.admin_delete_quest(int);
create or replace function public.admin_delete_quest(p_day int, p_calendar uuid default '00000000-0000-0000-0000-000000000001')
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.can_edit(p_calendar) then
    raise exception 'Only this calendar''s creator can do that';
  end if;
  delete from public.quests where calendar_id = p_calendar and day = p_day; -- secrets cascade
  delete from public.quest_overrides where calendar_id = p_calendar and day = p_day;
end
$$;

drop function if exists public.admin_save_override(uuid, int, text, text, jsonb, text[], text, text, text);
create or replace function public.admin_save_override(
  p_user uuid, p_day int, p_title text, p_kind text, p_content jsonb, p_answers text[], p_reward text, p_hint text, p_badge_letter text,
  p_calendar uuid default '00000000-0000-0000-0000-000000000001')
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_answers text[] := nullif(array_remove(coalesce(p_answers, '{}'), ''), '{}');
  v_content jsonb := case when p_content is null or p_content = '{}'::jsonb or jsonb_typeof(p_content) <> 'object' then null else p_content end;
begin
  if not public.can_edit(p_calendar) then
    raise exception 'Only this calendar''s creator can do that';
  end if;
  if not public.is_member(p_calendar, p_user) then
    raise exception 'That person isn''t one of this calendar''s friends';
  end if;
  if p_day not between 1 and 25 then
    raise exception 'Day must be 1–25';
  end if;
  if nullif(trim(p_title), '') is null and nullif(p_kind, '') is null and v_content is null and v_answers is null
     and nullif(trim(p_reward), '') is null and nullif(trim(p_hint), '') is null and nullif(trim(p_badge_letter), '') is null then
    delete from public.quest_overrides where calendar_id = p_calendar and user_id = p_user and day = p_day;
    return;
  end if;
  insert into public.quest_overrides (calendar_id, user_id, day, title, kind, content, answers, reward, hint, badge_letter)
    values (p_calendar, p_user, p_day, nullif(trim(p_title), ''), nullif(p_kind, ''), v_content, v_answers,
            nullif(trim(p_reward), ''), nullif(trim(p_hint), ''), nullif(trim(p_badge_letter), ''))
    on conflict (calendar_id, user_id, day) do update set
      title = excluded.title, kind = excluded.kind, content = excluded.content, answers = excluded.answers,
      reward = excluded.reward, hint = excluded.hint, badge_letter = excluded.badge_letter;
end
$$;

-- Players and their progress: everyone for the main calendar, the invited friends otherwise.
drop function if exists public.admin_dashboard();
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
        'email', au.email,
        'is_admin', v_main and p.is_admin,
        'created_at', au.created_at,
        'last_seen_at', p.last_seen_at,
        'current_theme', p.current_theme,
        'progress', coalesce((
          select jsonb_agg(jsonb_build_object('day', pr.day, 'attempts', pr.attempts, 'solved_at', pr.solved_at) order by pr.day)
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
      where v_main or (au.email_confirmed_at is not null and exists (
        select 1 from public.calendar_members m where m.calendar_id = p_calendar and m.email = lower(au.email)))
    ) x
  ), '[]'::jsonb);
end
$$;

-- ---------------------------------------------------------------- calendars

-- Calendars the signed-in user can play (main first), plus their own for previewing.
create or replace function public.get_my_calendars()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id,
      'title', c.title,
      'is_main', c.id = public.main_calendar(),
      'is_owner', c.owner_id = auth.uid(),
      'owner_name', p.display_name)
    order by c.id = public.main_calendar() desc, c.owner_id = auth.uid() desc, c.created_at), '[]'::jsonb)
  from public.calendars c
  left join public.profiles p on p.id = c.owner_id
  where auth.uid() is not null and public.can_play(c.id)
$$;

-- The user's own calendar with its invite list, or null.
create or replace function public.my_calendar()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'id', c.id,
    'title', c.title,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
          'email', m.email,
          'name', (select p.display_name from auth.users au join public.profiles p on p.id = au.id
                   where lower(au.email) = m.email and au.email_confirmed_at is not null limit 1))
        order by m.added_at)
      from public.calendar_members m where m.calendar_id = c.id), '[]'::jsonb))
  from public.calendars c
  where c.owner_id = auth.uid()
$$;

create or replace function public.create_calendar(p_title text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Please sign in first';
  end if;
  if public.my_email() is null then
    raise exception 'Please confirm your email first';
  end if;
  if exists (select 1 from public.calendars where owner_id = auth.uid()) then
    raise exception 'You already have a calendar';
  end if;
  if coalesce(trim(p_title), '') = '' or length(trim(p_title)) > 60 then
    raise exception 'Give your calendar a name (up to 60 characters)';
  end if;
  insert into public.calendars (owner_id, title) values (auth.uid(), trim(p_title)) returning id into v_id;
  return v_id;
end
$$;

create or replace function public.rename_calendar(p_title text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if coalesce(trim(p_title), '') = '' or length(trim(p_title)) > 60 then
    raise exception 'Give your calendar a name (up to 60 characters)';
  end if;
  update public.calendars set title = trim(p_title) where owner_id = auth.uid();
end
$$;

create or replace function public.add_calendar_member(p_email text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_cal uuid;
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  select id into v_cal from public.calendars where owner_id = auth.uid();
  if v_cal is null then
    raise exception 'Create your calendar first';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'That doesn''t look like an email address';
  end if;
  if v_email = public.my_email() then
    raise exception 'Add your friends — you can already preview your own calendar';
  end if;
  if exists (select 1 from public.calendar_members where calendar_id = v_cal and email = v_email) then
    return;
  end if;
  if (select count(*) from public.calendar_members where calendar_id = v_cal) >= 3 then
    raise exception 'A calendar can have up to 3 friends';
  end if;
  insert into public.calendar_members (calendar_id, email) values (v_cal, v_email);
end
$$;

create or replace function public.remove_calendar_member(p_email text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.calendar_members m
    using public.calendars c
    where c.id = m.calendar_id and c.owner_id = auth.uid() and m.email = lower(trim(p_email));
end
$$;

-- Deletes the user's calendar with all its quests, progress and guesses
-- (the app removes the photos first).
create or replace function public.delete_my_calendar()
returns void
language sql security definer set search_path = ''
as $$ delete from public.calendars where owner_id = auth.uid() $$;

-- ---------------------------------------------------------------- photos

create or replace function public.image_calendar(p_name text)
returns uuid language sql immutable set search_path = ''
as $$
  select coalesce(
    substring(p_name from '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/')::uuid,
    public.main_calendar())
$$;

create or replace function public.image_day(p_name text)
returns int language sql immutable set search_path = ''
as $$ select nullif(substring(p_name from '(?:^|/)day-(\d{1,2})/'), '')::int $$;

-- Friend calendars get up to 100 photos (the main calendar has no limit).
create or replace function public.calendar_photo_room(p_cal uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select p_cal = public.main_calendar() or (
    select count(*) from storage.objects o
    where o.bucket_id = 'quest-images' and o.name like p_cal::text || '/%') < 100
$$;

update storage.buckets
  set file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  where id = 'quest-images';

drop policy if exists "quest images: read once the day is open" on storage.objects;
drop policy if exists "quest images: admins upload" on storage.objects;
drop policy if exists "quest images: admins update" on storage.objects;
drop policy if exists "quest images: admins delete" on storage.objects;

create policy "quest images: read once the day is open" on storage.objects for select to authenticated
  using (bucket_id = 'quest-images' and public.day_open(public.image_calendar(name), public.image_day(name)));
create policy "quest images: editors upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'quest-images' and public.can_edit(public.image_calendar(name))
              and public.image_day(name) between 1 and 25
              and public.calendar_photo_room(public.image_calendar(name)));
create policy "quest images: editors update" on storage.objects for update to authenticated
  using (bucket_id = 'quest-images' and public.can_edit(public.image_calendar(name)));
create policy "quest images: editors delete" on storage.objects for delete to authenticated
  using (bucket_id = 'quest-images' and public.can_edit(public.image_calendar(name)));

-- ---------------------------------------------------------------- permissions

do $$
declare
  f text;
begin
  foreach f in array array[
    'main_calendar()', 'my_email()', 'can_edit(uuid)', 'can_play(uuid)', 'day_open(uuid, int)', 'is_member(uuid, uuid)',
    'get_quest(int, uuid)', 'submit_answer(int, text, uuid)', 'get_my_progress(uuid)',
    'hot_cold_probe(int, float8, float8, int, uuid)', 'hangman_letter(int, text, int, uuid)',
    'admin_quests(uuid)', 'admin_save_quest(int, text, text, jsonb, text[], text, text, text, uuid)',
    'admin_delete_quest(int, uuid)', 'admin_save_override(uuid, int, text, text, jsonb, text[], text, text, text, uuid)',
    'admin_dashboard(uuid)', 'get_my_calendars()', 'my_calendar()', 'create_calendar(text)', 'rename_calendar(text)',
    'add_calendar_member(text)', 'remove_calendar_member(text)', 'delete_my_calendar()', 'calendar_photo_room(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end
$$;
