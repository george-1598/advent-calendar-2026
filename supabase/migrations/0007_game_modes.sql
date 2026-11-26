-- Game modes. Every game ends in one submitted answer that the server checks,
-- so solutions never reach the browser:
--   riddle / song / anagram / treasure : text match against `answers` (as before)
--   wordle   : text match + a colour pattern (g/y/b) per letter
--   map      : "lat,lng" vs answers[1] = "lat,lng,radius_m" → distance
--   quiz     : "1,0,2" (chosen option per question) vs answers[1]
--   timeline : "b,a,c" (item ids in order) vs answers[1]

create or replace function public.wordle_pattern(p_guess text, p_target text)
returns text
language plpgsql immutable
set search_path = ''
as $$
declare
  g text[] := regexp_split_to_array(p_guess, '');
  t text[] := regexp_split_to_array(p_target, '');
  n int := coalesce(array_length(g, 1), 0);
  m int := coalesce(array_length(t, 1), 0);
  res text[];
  used boolean[];
  i int;
  j int;
begin
  if n = 0 then
    return '';
  end if;
  res := array_fill('b'::text, array[n]);
  used := array_fill(false, array[greatest(m, 1)]);
  for i in 1..n loop
    if i <= m and g[i] = t[i] then
      res[i] := 'g';
      used[i] := true;
    end if;
  end loop;
  for i in 1..n loop
    continue when res[i] = 'g';
    for j in 1..m loop
      if not used[j] and g[i] = t[j] then
        res[i] := 'y';
        used[j] := true;
        exit;
      end if;
    end loop;
  end loop;
  return array_to_string(res, '');
end
$$;

create or replace function public.submit_answer(p_day int, p_answer text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  e record;
  v_progress public.progress;
  v_correct boolean;
  v_kind text;
  v_extra jsonb := '{}'::jsonb;
  v_lat float8; v_lng float8; t_lat float8; t_lng float8; t_r float8; v_dist float8;
  g text[]; t text[];
  gw text; tw text;
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
  v_kind := coalesce(e.kind, 'riddle');

  insert into public.progress (user_id, day) values (v_uid, p_day) on conflict do nothing;
  select * into v_progress from public.progress
    where user_id = v_uid and day = p_day
    for update;

  if v_progress.solved_at is not null then
    v_correct := true;
  else
    if v_progress.last_attempt_at > now() - interval '2 seconds' then
      raise exception 'Slow down a little, then try again';
    end if;

    if v_kind = 'map' then
      begin
        v_lat := split_part(p_answer, ',', 1)::float8;
        v_lng := split_part(p_answer, ',', 2)::float8;
        t_lat := split_part(e.answers[1], ',', 1)::float8;
        t_lng := split_part(e.answers[1], ',', 2)::float8;
        t_r := coalesce(nullif(split_part(e.answers[1], ',', 3), '')::float8, 500);
      exception when others then
        raise exception 'Drop a pin on the map first';
      end;
      v_dist := 2 * 6371000 * asin(sqrt(
        power(sin(radians(t_lat - v_lat) / 2), 2)
        + cos(radians(v_lat)) * cos(radians(t_lat)) * power(sin(radians(t_lng - v_lng) / 2), 2)));
      v_correct := v_dist <= t_r;
      v_extra := jsonb_build_object('distance_m', round(v_dist));
    elsif v_kind in ('quiz', 'timeline') then
      g := string_to_array(replace(coalesce(p_answer, ''), ' ', ''), ',');
      t := string_to_array(replace(e.answers[1], ' ', ''), ',');
      v_correct := g = t;
      v_extra := jsonb_build_object(
        'right', (select count(*) from generate_subscripts(t, 1) as i where g[i] = t[i]),
        'total', coalesce(array_length(t, 1), 0));
    elsif v_kind = 'wordle' then
      gw := replace(public.normalize_answer(p_answer), ' ', '');
      tw := replace(public.normalize_answer(e.answers[1]), ' ', '');
      v_correct := gw = tw;
      v_extra := jsonb_build_object('pattern', public.wordle_pattern(gw, tw));
    else
      v_correct := public.normalize_answer(p_answer) in (
        select public.normalize_answer(a) from unnest(e.answers) as a
      );
    end if;

    insert into public.guess_log (user_id, day, guess, correct)
      values (v_uid, p_day, left(coalesce(p_answer, ''), 200), v_correct);

    update public.progress
      set attempts = attempts + case when v_correct then 0 else 1 end,
          last_attempt_at = now(),
          solved_at = case when v_correct then now() end
      where user_id = v_uid and day = p_day
      returning * into v_progress;
  end if;

  return jsonb_build_object(
    'correct', v_correct,
    'attempts', v_progress.attempts,
    'solved_at', v_progress.solved_at,
    'reward', case when v_correct then e.reward end,
    'hint', case when v_correct or v_progress.attempts >= 3 then e.hint end,
    'badge_letter', case when v_correct then e.badge_letter end
  ) || v_extra;
end
$$;

-- Player overrides: an empty/absent game content means "use the default game".
create or replace function public.admin_save_override(
  p_user uuid,
  p_day int,
  p_title text,
  p_kind text,
  p_content jsonb,
  p_answers text[],
  p_reward text,
  p_hint text,
  p_badge_letter text
)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_answers text[] := nullif(array_remove(coalesce(p_answers, '{}'), ''), '{}');
  v_content jsonb := case when p_content is null or p_content = '{}'::jsonb or jsonb_typeof(p_content) <> 'object' then null else p_content end;
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;
  if p_day not between 1 and 25 then
    raise exception 'Day must be 1–25';
  end if;
  if nullif(trim(p_title), '') is null and nullif(p_kind, '') is null and v_content is null and v_answers is null
     and nullif(trim(p_reward), '') is null and nullif(trim(p_hint), '') is null and nullif(trim(p_badge_letter), '') is null then
    delete from public.quest_overrides where user_id = p_user and day = p_day;
    return;
  end if;
  insert into public.quest_overrides (user_id, day, title, kind, content, answers, reward, hint, badge_letter)
    values (p_user, p_day, nullif(trim(p_title), ''), nullif(p_kind, ''), v_content, v_answers,
            nullif(trim(p_reward), ''), nullif(trim(p_hint), ''), nullif(trim(p_badge_letter), ''))
    on conflict (user_id, day) do update set
      title = excluded.title, kind = excluded.kind, content = excluded.content, answers = excluded.answers,
      reward = excluded.reward, hint = excluded.hint, badge_letter = excluded.badge_letter;
end
$$;
