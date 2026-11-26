-- Roles: players (everyone) and creators (can make a calendar for friends).
-- Players ask the organiser; the organiser approves or declines. Admins are
-- always creators. Removing the role freezes a calendar (still playable,
-- no longer editable).

alter table public.profiles
  add column if not exists creator_status text check (creator_status in ('pending', 'approved', 'declined')),
  add column if not exists creator_note text check (length(creator_note) <= 300),
  add column if not exists creator_requested_at timestamptz;

create or replace function public.is_creator(p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce((select is_admin or creator_status = 'approved' from public.profiles where id = p_user), false) $$;

-- Editing a friend calendar needs the creator role too.
create or replace function public.can_edit(p_cal uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select case
    when p_cal = public.main_calendar() then public.is_admin()
    else exists (select 1 from public.calendars c where c.id = p_cal and c.owner_id = auth.uid()) and public.is_creator()
  end
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
  if not public.is_creator() then
    raise exception 'Ask the organiser to make you a creator first';
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

create or replace function public.request_creator(p_note text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Please sign in first';
  end if;
  if public.is_creator() then
    return;
  end if;
  if length(coalesce(p_note, '')) > 300 then
    raise exception 'Keep the note under 300 characters';
  end if;
  update public.profiles
    set creator_status = 'pending', creator_note = nullif(trim(p_note), ''), creator_requested_at = now()
    where id = auth.uid();
end
$$;

create or replace function public.cancel_creator_request()
returns void
language sql security definer set search_path = ''
as $$ update public.profiles set creator_status = null, creator_note = null where id = auth.uid() and creator_status = 'pending' $$;

-- p_status: 'approved', 'declined' or null (back to a plain player).
create or replace function public.admin_set_creator(p_user uuid, p_status text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;
  if p_status is not null and p_status not in ('approved', 'declined') then
    raise exception 'Unknown status';
  end if;
  update public.profiles set creator_status = p_status where id = p_user;
end
$$;

create or replace function public.admin_creator_requests()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name, 'email', au.email,
                                        'note', p.creator_note, 'requested_at', p.creator_requested_at) order by p.creator_requested_at)
    from public.profiles p join auth.users au on au.id = p.id
    where p.creator_status = 'pending'), '[]'::jsonb);
end
$$;

-- Players tab shows each player's role.
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
        'creator_status', case when v_main then p.creator_status end,
        'creator_note', case when v_main then p.creator_note end,
        'creator_requested_at', case when v_main then p.creator_requested_at end,
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

do $$
declare
  f text;
begin
  foreach f in array array[
    'is_creator(uuid)', 'can_edit(uuid)', 'create_calendar(text)', 'request_creator(text)', 'cancel_creator_request()',
    'admin_set_creator(uuid, text)', 'admin_creator_requests()', 'admin_dashboard(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end
$$;
