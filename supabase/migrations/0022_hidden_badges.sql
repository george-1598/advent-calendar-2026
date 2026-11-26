-- Badges are festive icons on the phone; their phrase characters stay hidden
-- until a player has all 25 (then the badge game reveals them). So per-day
-- answers no longer include a badge character, and the badge game only sends
-- the characters once the collection is complete.

create or replace function public.day_badge(p_cal uuid, p_day int, p_fallback text default null)
returns text language sql stable security definer set search_path = ''
as $$ select null::text $$;
revoke execute on function public.day_badge(uuid, int, text) from public, anon, authenticated;

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
    -- The characters stay hidden until all 25 are collected (until then, just the count).
    'tiles', case when v_count = 25 then v_tiles else '[]'::jsonb end,
    'count', v_count,
    'complete', v_count = 25,
    'attempts', coalesce(g.attempts, 0),
    'solved_at', g.solved_at,
    'answer', case when g.solved_at is not null then to_jsonb(c.badge_chars) end,
    'phrase', case when g.solved_at is not null then public.personalize(c.badge_phrase, v_uid) end,
    'message', case when g.solved_at is not null then public.personalize(c.finale_message, v_uid) end,
    'from', (select pr.display_name from public.profiles pr where pr.id = c.owner_id));
end
$$;
revoke execute on function public.get_badge_game(uuid) from public, anon;
grant execute on function public.get_badge_game(uuid) to authenticated;
