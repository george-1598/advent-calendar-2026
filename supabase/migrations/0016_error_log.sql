-- Error log: the app reports crashes and failed server calls here, so problems
-- on players' phones are visible on the admin page. Repeats of the same error
-- from the same person within an hour are counted, not stored again.

create table if not exists public.client_errors (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('crash', 'error', 'promise', 'network', 'server')),
  message text not null,
  detail text,
  url text,
  user_agent text,
  count int not null default 1,
  created_at timestamptz not null default now(),
  last_at timestamptz not null default now()
);
alter table public.client_errors enable row level security;
create index if not exists client_errors_recent on public.client_errors (last_at desc);

create or replace function public.log_client_error(p_kind text, p_message text, p_detail text, p_url text, p_user_agent text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_msg text := left(coalesce(nullif(trim(p_message), ''), 'Unknown error'), 500);
  v_id bigint;
begin
  if p_kind not in ('crash', 'error', 'promise', 'network', 'server') then
    return;
  end if;
  -- Flood guard: at most 300 new entries an hour across everyone.
  if (select count(*) from public.client_errors where created_at > now() - interval '1 hour') >= 300 then
    return;
  end if;
  select id into v_id from public.client_errors
    where user_id is not distinct from auth.uid() and message = v_msg and last_at > now() - interval '1 hour'
    order by last_at desc limit 1;
  if v_id is not null then
    update public.client_errors set count = count + 1, last_at = now() where id = v_id;
  else
    insert into public.client_errors (user_id, kind, message, detail, url, user_agent)
      values (auth.uid(), p_kind, v_msg, left(p_detail, 4000), left(p_url, 500), left(p_user_agent, 300));
  end if;
end
$$;
revoke execute on function public.log_client_error(text, text, text, text, text) from public;
grant execute on function public.log_client_error(text, text, text, text, text) to anon, authenticated;

create or replace function public.admin_errors()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', e.id, 'kind', e.kind, 'message', e.message, 'detail', e.detail, 'url', e.url,
      'user_agent', e.user_agent, 'count', e.count, 'created_at', e.created_at, 'last_at', e.last_at,
      'name', p.display_name) order by e.last_at desc)
    from (select * from public.client_errors order by last_at desc limit 200) e
    left join public.profiles p on p.id = e.user_id), '[]'::jsonb);
end
$$;

create or replace function public.admin_clear_errors()
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;
  delete from public.client_errors where true;
end
$$;
revoke execute on function public.admin_errors() from public, anon;
grant execute on function public.admin_errors() to authenticated;
revoke execute on function public.admin_clear_errors() from public, anon;
grant execute on function public.admin_clear_errors() to authenticated;
