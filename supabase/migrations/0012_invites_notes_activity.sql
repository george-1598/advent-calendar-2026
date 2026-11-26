-- Invite links instead of emails, hints for stuck friends, thank-you notes and
-- an activity feed for calendar creators (and the organiser).

-- ---------------------------------------------------------------- members by account, joined through links

drop table if exists public.calendar_members cascade;
create table public.calendar_members (
  calendar_id uuid not null references public.calendars (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (calendar_id, user_id)
);
alter table public.calendar_members enable row level security;
create index calendar_members_user on public.calendar_members (user_id);

-- One-time invite links (the token is the secret part of the link).
create table if not exists public.calendar_invites (
  token text primary key,
  calendar_id uuid not null references public.calendars (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.calendar_invites enable row level security;

create or replace function public.can_play(p_cal uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and (
    p_cal = public.main_calendar()
    or public.can_edit(p_cal)
    or exists (select 1 from public.calendar_members m where m.calendar_id = p_cal and m.user_id = auth.uid()))
$$;

create or replace function public.is_member(p_cal uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select p_cal = public.main_calendar()
    or exists (select 1 from public.calendar_members m where m.calendar_id = p_cal and m.user_id = p_user)
$$;

-- No confirmed email needed any more: friends join through links.
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

drop function if exists public.my_calendar();
create or replace function public.my_calendar()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'id', c.id,
    'title', c.title,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'name', p.display_name, 'joined_at', m.joined_at) order by m.joined_at)
      from public.calendar_members m join public.profiles p on p.id = m.user_id
      where m.calendar_id = c.id), '[]'::jsonb),
    'invites', coalesce((
      select jsonb_agg(jsonb_build_object('token', i.token, 'created_at', i.created_at) order by i.created_at)
      from public.calendar_invites i where i.calendar_id = c.id), '[]'::jsonb))
  from public.calendars c
  where c.owner_id = auth.uid()
$$;

drop function if exists public.add_calendar_member(text);
drop function if exists public.remove_calendar_member(text);

-- A new one-time link. Friends + unused links can't exceed 3.
create or replace function public.create_invite()
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_cal uuid;
  v_token text := left(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 28);
begin
  select id into v_cal from public.calendars where owner_id = auth.uid();
  if v_cal is null then
    raise exception 'Create your calendar first';
  end if;
  if (select count(*) from public.calendar_members where calendar_id = v_cal)
     + (select count(*) from public.calendar_invites where calendar_id = v_cal) >= 3 then
    raise exception 'A calendar can have up to 3 friends';
  end if;
  insert into public.calendar_invites (token, calendar_id) values (v_token, v_cal);
  return v_token;
end
$$;

create or replace function public.revoke_invite(p_token text)
returns void
language sql security definer set search_path = ''
as $$
  delete from public.calendar_invites i using public.calendars c
  where c.id = i.calendar_id and c.owner_id = auth.uid() and i.token = p_token
$$;

create or replace function public.remove_calendar_member(p_user uuid)
returns void
language sql security definer set search_path = ''
as $$
  delete from public.calendar_members m using public.calendars c
  where c.id = m.calendar_id and c.owner_id = auth.uid() and m.user_id = p_user
$$;

-- What an invite link is for (shown before signing in). Reveals only the title and creator's name.
create or replace function public.invite_info(p_token text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('title', c.title, 'owner_name', p.display_name)
  from public.calendar_invites i
  join public.calendars c on c.id = i.calendar_id
  left join public.profiles p on p.id = c.owner_id
  where i.token = p_token
$$;

create or replace function public.join_calendar(p_token text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_cal uuid;
  v_owner uuid;
begin
  if auth.uid() is null then
    raise exception 'Please sign in first';
  end if;
  select i.calendar_id, c.owner_id into v_cal, v_owner
    from public.calendar_invites i join public.calendars c on c.id = i.calendar_id
    where i.token = p_token
    for update of i;
  if v_cal is null then
    raise exception 'This invite link has already been used or was cancelled. Ask for a new one.';
  end if;
  if v_owner = auth.uid() then
    raise exception 'That’s your own calendar — send the link to a friend';
  end if;
  if not exists (select 1 from public.calendar_members where calendar_id = v_cal and user_id = auth.uid()) then
    insert into public.calendar_members (calendar_id, user_id) values (v_cal, auth.uid());
    delete from public.calendar_invites where token = p_token;
  end if;
  return (select jsonb_build_object('id', c.id, 'title', c.title, 'owner_name', p.display_name)
          from public.calendars c left join public.profiles p on p.id = c.owner_id where c.id = v_cal);
end
$$;

-- Players and progress: everyone for the main calendar, the joined friends otherwise.
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
      where v_main or exists (select 1 from public.calendar_members m where m.calendar_id = p_calendar and m.user_id = p.id)
    ) x
  ), '[]'::jsonb);
end
$$;

-- ---------------------------------------------------------------- hints & thank-yous

create table if not exists public.calendar_notes (
  id bigint generated always as identity primary key,
  calendar_id uuid not null references public.calendars (id) on delete cascade,
  day int not null check (day between 1 and 25),
  kind text not null check (kind in ('hint', 'thanks')),
  from_user uuid not null references auth.users (id) on delete cascade,
  -- hints: the friend it's for; thank-yous: null (they go to the calendar's creator)
  to_user uuid references auth.users (id) on delete cascade,
  emoji text check (length(emoji) <= 16),
  body text check (length(body) <= 300),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
alter table public.calendar_notes enable row level security;
create unique index if not exists calendar_notes_one_thanks on public.calendar_notes (calendar_id, day, from_user) where kind = 'thanks';
create index if not exists calendar_notes_to on public.calendar_notes (calendar_id, to_user, day);

create or replace function public.send_hint(p_calendar uuid, p_user uuid, p_day int, p_text text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.can_edit(p_calendar) then
    raise exception 'Only this calendar''s creator can do that';
  end if;
  if p_calendar <> public.main_calendar() and not public.is_member(p_calendar, p_user) then
    raise exception 'That person isn''t one of this calendar''s friends';
  end if;
  if coalesce(trim(p_text), '') = '' or length(trim(p_text)) > 300 then
    raise exception 'Write a hint (up to 300 characters)';
  end if;
  insert into public.calendar_notes (calendar_id, day, kind, from_user, to_user, body)
    values (p_calendar, p_day, 'hint', auth.uid(), p_user, trim(p_text));
end
$$;

create or replace function public.send_thanks(p_calendar uuid, p_day int, p_emoji text, p_text text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.can_play(p_calendar) then
    raise exception 'You don''t have access to this calendar';
  end if;
  if not exists (select 1 from public.progress where user_id = auth.uid() and calendar_id = p_calendar and day = p_day and solved_at is not null) then
    raise exception 'Solve the day first';
  end if;
  if length(coalesce(p_text, '')) > 300 then
    raise exception 'Keep it under 300 characters';
  end if;
  insert into public.calendar_notes (calendar_id, day, kind, from_user, emoji, body)
    values (p_calendar, p_day, 'thanks', auth.uid(), nullif(p_emoji, ''), nullif(trim(p_text), ''))
    on conflict (calendar_id, day, from_user) where kind = 'thanks'
    do update set emoji = excluded.emoji, body = excluded.body, created_at = now(), read_at = null;
end
$$;

-- The player's own notes: hints sent to them and the thank-yous they sent.
create or replace function public.my_notes(p_calendar uuid default '00000000-0000-0000-0000-000000000001')
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', n.id, 'day', n.day, 'kind', n.kind, 'emoji', n.emoji, 'body', n.body,
      'from_name', p.display_name, 'created_at', n.created_at, 'read_at', n.read_at)
    order by n.created_at), '[]'::jsonb)
  from public.calendar_notes n
  left join public.profiles p on p.id = n.from_user
  where n.calendar_id = p_calendar
    and ((n.kind = 'hint' and n.to_user = auth.uid()) or (n.kind = 'thanks' and n.from_user = auth.uid()))
$$;

create or replace function public.mark_hints_read(p_calendar uuid, p_day int)
returns void
language sql security definer set search_path = ''
as $$
  update public.calendar_notes set read_at = now()
  where calendar_id = p_calendar and day = p_day and kind = 'hint' and to_user = auth.uid() and read_at is null
$$;

-- ---------------------------------------------------------------- activity feed

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
                                    'attempts', pr.attempts, 'at', pr.solved_at) as e
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

create or replace function public.mark_thanks_read(p_calendar uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if public.can_edit(p_calendar) then
    update public.calendar_notes set read_at = now()
    where calendar_id = p_calendar and kind = 'thanks' and read_at is null;
  end if;
end
$$;

-- ---------------------------------------------------------------- permissions

do $$
declare
  f text;
begin
  foreach f in array array[
    'can_play(uuid)', 'is_member(uuid, uuid)', 'create_calendar(text)', 'my_calendar()', 'create_invite()',
    'revoke_invite(text)', 'remove_calendar_member(uuid)', 'join_calendar(text)', 'admin_dashboard(uuid)',
    'send_hint(uuid, uuid, int, text)', 'send_thanks(uuid, int, text, text)', 'my_notes(uuid)',
    'mark_hints_read(uuid, int)', 'calendar_activity(uuid)', 'mark_thanks_read(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end
$$;
-- The join page shows who invited you before you sign in.
revoke execute on function public.invite_info(text) from public;
grant execute on function public.invite_info(text) to anon, authenticated;
