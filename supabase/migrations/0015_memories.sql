-- Photo memories: after solving a day, a player can add a photo of the real gift.
-- Private: only the player and the calendar's creator can see it.
-- Storage path: memories/<calendar id>/<user id>/<day>-<uuid>.jpg

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('memories', 'memories', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do nothing;

create table if not exists public.memories (
  calendar_id uuid not null references public.calendars (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  day int not null check (day between 1 and 25),
  path text not null,
  caption text check (length(caption) <= 200),
  created_at timestamptz not null default now(),
  primary key (calendar_id, user_id, day)
);
alter table public.memories enable row level security;

create or replace function public.memory_calendar(p_name text)
returns uuid language sql immutable set search_path = ''
as $$ select case when split_part(p_name, '/', 1) ~ '^[0-9a-f-]{36}$' then split_part(p_name, '/', 1)::uuid end $$;
create or replace function public.memory_user(p_name text)
returns uuid language sql immutable set search_path = ''
as $$ select case when split_part(p_name, '/', 2) ~ '^[0-9a-f-]{36}$' then split_part(p_name, '/', 2)::uuid end $$;

drop policy if exists "memories: own upload" on storage.objects;
drop policy if exists "memories: own or creator read" on storage.objects;
drop policy if exists "memories: own delete" on storage.objects;
create policy "memories: own upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'memories' and public.memory_user(name) = auth.uid() and public.can_play(public.memory_calendar(name)));
create policy "memories: own or creator read" on storage.objects for select to authenticated
  using (bucket_id = 'memories' and (public.memory_user(name) = auth.uid() or public.can_edit(public.memory_calendar(name))));
create policy "memories: own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'memories' and public.memory_user(name) = auth.uid());

-- Returns the previous photo's path (if replaced) so the app can delete the file.
create or replace function public.save_memory(p_calendar uuid, p_day int, p_path text, p_caption text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_old text;
begin
  if not public.can_play(p_calendar) then
    raise exception 'You don''t have access to this calendar';
  end if;
  if not exists (select 1 from public.progress where user_id = auth.uid() and calendar_id = p_calendar and day = p_day and solved_at is not null) then
    raise exception 'Solve the day first';
  end if;
  if p_path not like p_calendar::text || '/' || auth.uid()::text || '/%' then
    raise exception 'That photo isn''t yours';
  end if;
  select path into v_old from public.memories where calendar_id = p_calendar and user_id = auth.uid() and day = p_day;
  insert into public.memories (calendar_id, user_id, day, path, caption)
    values (p_calendar, auth.uid(), p_day, p_path, nullif(trim(p_caption), ''))
    on conflict (calendar_id, user_id, day) do update set path = excluded.path, caption = excluded.caption, created_at = now();
  return case when v_old is distinct from p_path then v_old end;
end
$$;

create or replace function public.set_memory_caption(p_calendar uuid, p_day int, p_caption text)
returns void
language sql security definer set search_path = ''
as $$
  update public.memories set caption = nullif(trim(p_caption), '')
  where calendar_id = p_calendar and user_id = auth.uid() and day = p_day
$$;

create or replace function public.delete_memory(p_calendar uuid, p_day int)
returns text
language sql security definer set search_path = ''
as $$
  delete from public.memories where calendar_id = p_calendar and user_id = auth.uid() and day = p_day returning path
$$;

create or replace function public.my_memories(p_calendar uuid default '00000000-0000-0000-0000-000000000001')
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('day', day, 'path', path, 'caption', caption, 'created_at', created_at) order by day), '[]'::jsonb)
  from public.memories where calendar_id = p_calendar and user_id = auth.uid()
$$;

-- The activity feed now includes photos.
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
          union all
          select jsonb_build_object('type', 'memory', 'user_id', m.user_id, 'name', p.display_name, 'day', m.day,
                                    'path', m.path, 'body', m.caption, 'at', m.created_at)
          from public.memories m join public.profiles p on p.id = m.user_id
          where m.calendar_id = p_calendar
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
    'save_memory(uuid, int, text, text)', 'set_memory_caption(uuid, int, text)', 'delete_memory(uuid, int)',
    'my_memories(uuid)', 'calendar_activity(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end
$$;
