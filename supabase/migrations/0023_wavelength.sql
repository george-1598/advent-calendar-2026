-- Wavelength: set a needle on a scale between two ends; the server says how
-- close you are (never which way). Once solved, the target is shown (the
-- coloured bands), so get_my_progress returns it for solved wavelength days.

create or replace function public.check_answer(p_kind text, p_answers text[], p_answer text)
returns jsonb
language plpgsql immutable
set search_path = ''
as $$
declare
  v_lat float8; v_lng float8; t_lat float8; t_lng float8; t_r float8; v_dist float8;
  g text[]; t text[];
  gw text; tw text;
  v_guess float8; v_target float8; v_tol float8; v_d float8;
begin
  if coalesce(array_length(p_answers, 1), 0) = 0 then
    return jsonb_build_object('correct', false);
  end if;
  case coalesce(p_kind, 'riddle')
    when 'map' then
      begin
        v_lat := split_part(p_answer, ',', 1)::float8;
        v_lng := split_part(p_answer, ',', 2)::float8;
        t_lat := split_part(p_answers[1], ',', 1)::float8;
        t_lng := split_part(p_answers[1], ',', 2)::float8;
        t_r := coalesce(nullif(split_part(p_answers[1], ',', 3), '')::float8, 500);
      exception when others then
        raise exception 'Drop a pin on the map first';
      end;
      v_dist := 2 * 6371000 * asin(sqrt(
        power(sin(radians(t_lat - v_lat) / 2), 2)
        + cos(radians(v_lat)) * cos(radians(t_lat)) * power(sin(radians(t_lng - v_lng) / 2), 2)));
      return jsonb_build_object('correct', v_dist <= t_r, 'distance_m', round(v_dist));
    when 'hotcold' then
      begin
        v_lat := split_part(p_answer, ',', 1)::float8;
        v_lng := split_part(p_answer, ',', 2)::float8;
        t_lat := split_part(p_answers[1], ',', 1)::float8;
        t_lng := split_part(p_answers[1], ',', 2)::float8;
        t_r := coalesce(nullif(split_part(p_answers[1], ',', 3), '')::float8, 0.06);
      exception when others then
        raise exception 'Tap the picture first';
      end;
      return jsonb_build_object('correct', sqrt(power(v_lat - t_lat, 2) + power(v_lng - t_lng, 2)) <= t_r);
    when 'quiz', 'timeline', 'truths' then
      g := string_to_array(replace(coalesce(p_answer, ''), ' ', ''), ',');
      t := string_to_array(replace(p_answers[1], ' ', ''), ',');
      return jsonb_build_object(
        'correct', g = t,
        'right', (select count(*) from generate_subscripts(t, 1) as i where g[i] = t[i]),
        'total', coalesce(array_length(t, 1), 0));
    when 'wavelength' then
      -- answer: a position 0–100; answers[1]: "target,tolerance". The target is only
      -- returned once it's been hit; misses get how close they were, not which way.
      begin
        v_guess := p_answer::float8;
        v_target := split_part(p_answers[1], ',', 1)::float8;
        v_tol := coalesce(nullif(split_part(p_answers[1], ',', 2), '')::float8, 7);
      exception when others then
        raise exception 'Move the needle first';
      end;
      v_d := abs(v_guess - v_target);
      return jsonb_build_object(
        'correct', v_d <= v_tol,
        'zone', case when v_d <= v_tol then 'bull' when v_d <= v_tol * 2 then 'close' when v_d <= v_tol * 3 then 'near' else 'far' end,
        'target', case when v_d <= v_tol then p_answers[1] end);
    when 'wordle' then
      gw := replace(public.normalize_answer(p_answer), ' ', '');
      tw := replace(public.normalize_answer(p_answers[1]), ' ', '');
      return jsonb_build_object('correct', gw = tw, 'pattern', public.wordle_pattern(gw, tw));
    else
      return jsonb_build_object('correct', public.normalize_answer(p_answer) in (
        select public.normalize_answer(a) from unnest(p_answers) as a));
  end case;
end
$$;

create or replace function public.revealed_answer(p_kind text, p_answers text[])
returns text language sql immutable set search_path = ''
as $$
  select case when coalesce(p_kind, 'riddle') in ('riddle', 'wordle', 'song', 'anagram', 'treasure', 'morse', 'zoom', 'emoji', 'hangman', 'cipher', 'suspects', 'einstein', 'wavelength')
    then p_answers[1] end
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
    case when p.solved_at is not null then public.day_badge(p.calendar_id, p.day, e.badge_letter) end,
    p.chain_step,
    p.gave_up,
    public.hint_count(e.hint),
    case when p.gave_up or (p.solved_at is not null and e.kind = 'wavelength') then public.revealed_answer(e.kind, e.answers) end
  from public.progress p
  left join lateral public.effective_quest(p.user_id, p.day, p.calendar_id) e on true
  where p.user_id = auth.uid() and p.calendar_id = p_calendar
$$;
revoke execute on function public.get_my_progress(uuid) from public, anon;
grant execute on function public.get_my_progress(uuid) to authenticated;
revoke execute on function public.check_answer(text, text[], text) from public, anon;
