-- Which open days already have a quest for the signed-in player (editors: every
-- day that's filled in). Says nothing about what's in them; empty open days show
-- as "work in progress" on the calendar.
create or replace function public.ready_days(p_calendar uuid default '00000000-0000-0000-0000-000000000001')
returns int[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(d order by d), '{}')
  from generate_series(1, 25) as d
  where public.day_open(p_calendar, d)
    and exists (select 1 from public.effective_quest(auth.uid(), d, p_calendar))
$$;
revoke execute on function public.ready_days(uuid) from public, anon;
grant execute on function public.ready_days(uuid) to authenticated;
