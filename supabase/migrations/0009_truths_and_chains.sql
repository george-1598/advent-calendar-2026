-- Two truths and a lie, and multi-step chains.
--
-- Chains: content.parts = [{kind, content}], and answers[i] is a JSON array of
-- the accepted answers for step i. The server tracks which step each player is
-- on (progress.chain_step) and only accepts the current step.

alter table public.progress add column if not exists chain_step int not null default 0;

-- One game's answer check, for any kind. Returns {correct, ...feedback}.
create or replace function public.check_answer(p_kind text, p_answers text[], p_answer text)
returns jsonb
language plpgsql immutable
set search_path = ''
as $$
declare
  v_lat float8; v_lng float8; t_lat float8; t_lng float8; t_r float8; v_dist float8;
  g text[]; t text[];
  gw text; tw text;
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

-- The game kind and answers for one step (or the whole quest when it isn't a chain).
create or replace function public.quest_part(p_user uuid, p_day int, p_step int)
returns table (kind text, answers text[], steps int)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  e record;
begin
  select * into e from public.effective_quest(p_user, p_day);
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
revoke execute on function public.quest_part(uuid, int, int) from public, anon, authenticated;
revoke execute on function public.check_answer(text, text[], text) from public, anon;

create or replace function public.submit_answer(p_day int, p_answer text)
returns jsonb
language plpgsql security definer
set search_path = ''
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
  if now() < public.unlock_at(p_day) and not public.is_admin() then
    raise exception 'This day is still locked';
  end if;

  select * into e from public.effective_quest(v_uid, p_day);
  if not found or coalesce(array_length(e.answers, 1), 0) = 0 then
    raise exception 'This quest isn''t ready yet';
  end if;

  insert into public.progress (user_id, day) values (v_uid, p_day) on conflict do nothing;
  select * into v_progress from public.progress
    where user_id = v_uid and day = p_day
    for update;

  if v_progress.solved_at is not null then
    v_res := jsonb_build_object('correct', true);
    v_solved := true;
  else
    if v_progress.last_attempt_at > now() - interval '2 seconds' then
      raise exception 'Slow down a little, then try again';
    end if;

    select * into part from public.quest_part(v_uid, p_day, v_progress.chain_step);
    v_res := public.check_answer(part.kind, part.answers, p_answer);
    v_step_ok := (v_res ->> 'correct')::boolean;
    v_next := v_progress.chain_step + case when v_step_ok then 1 else 0 end;
    v_solved := v_step_ok and v_next >= coalesce(part.steps, 1);

    insert into public.guess_log (user_id, day, guess, correct)
      values (v_uid, p_day,
              left(case when e.kind = 'chain' then format('[step %s] %s', v_progress.chain_step + 1, coalesce(p_answer, '')) else coalesce(p_answer, '') end, 200),
              v_step_ok);

    update public.progress
      set attempts = attempts + case when v_step_ok then 0 else 1 end,
          last_attempt_at = now(),
          chain_step = case when v_solved then chain_step else v_next end,
          solved_at = case when v_solved then now() end
      where user_id = v_uid and day = p_day
      returning * into v_progress;
  end if;

  -- For chains, "correct" means this step was right; "solved" means the whole day.
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
create or replace function public.get_my_progress()
returns table (day int, attempts int, solved_at timestamptz, reward text, hint text, badge_letter text, chain_step int)
language sql stable security definer
set search_path = ''
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
  left join lateral public.effective_quest(p.user_id, p.day) e on true
  where p.user_id = auth.uid()
$$;
revoke execute on function public.get_my_progress() from public, anon;
grant execute on function public.get_my_progress() to authenticated;

-- Probes learn which step they're for (null = not a chain).
drop function if exists public.hot_cold_probe(int, float8, float8);
create or replace function public.hot_cold_probe(p_day int, p_x float8, p_y float8, p_step int default null)
returns text
language plpgsql stable security definer
set search_path = ''
as $$
declare
  part record;
  t_x float8; t_y float8; t_r float8; d float8;
begin
  if auth.uid() is null or (now() < public.unlock_at(p_day) and not public.is_admin()) then
    raise exception 'This day is still locked';
  end if;
  select * into part from public.quest_part(auth.uid(), p_day, coalesce(p_step, 0));
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
revoke execute on function public.hot_cold_probe(int, float8, float8, int) from public, anon;
grant execute on function public.hot_cold_probe(int, float8, float8, int) to authenticated;

drop function if exists public.hangman_letter(int, text);
create or replace function public.hangman_letter(p_day int, p_letter text, p_step int default null)
returns int[]
language plpgsql stable security definer
set search_path = ''
as $$
declare
  part record;
  w text;
  l text := lower(left(coalesce(p_letter, ''), 1));
  out int[] := '{}';
  i int;
begin
  if auth.uid() is null or (now() < public.unlock_at(p_day) and not public.is_admin()) then
    raise exception 'This day is still locked';
  end if;
  select * into part from public.quest_part(auth.uid(), p_day, coalesce(p_step, 0));
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
revoke execute on function public.hangman_letter(int, text, int) from public, anon;
grant execute on function public.hangman_letter(int, text, int) to authenticated;
