-- More game modes: morse, zoom reveal, memory, emoji, hangman, cipher, hot & cold.
-- Plus private photo storage for quest images.

-- ---------------------------------------------------------------- photo storage
insert into storage.buckets (id, name, public)
  values ('quest-images', 'quest-images', false)
  on conflict (id) do nothing;

-- Day number from a path like "day-07/abc.jpg".
create or replace function public.image_day(p_name text)
returns int
language sql immutable
set search_path = ''
as $$
  select nullif(substring(p_name from '^day-(\d{1,2})/'), '')::int
$$;

drop policy if exists "quest images: read once the day is open" on storage.objects;
create policy "quest images: read once the day is open" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'quest-images'
    and (public.is_admin() or now() >= public.unlock_at(public.image_day(name)))
  );
drop policy if exists "quest images: admins upload" on storage.objects;
create policy "quest images: admins upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'quest-images' and public.is_admin());
drop policy if exists "quest images: admins update" on storage.objects;
create policy "quest images: admins update" on storage.objects
  for update to authenticated
  using (bucket_id = 'quest-images' and public.is_admin());
drop policy if exists "quest images: admins delete" on storage.objects;
create policy "quest images: admins delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'quest-images' and public.is_admin());

-- ---------------------------------------------------------------- probes
-- Hot & cold: how close a tap is (doesn't count as a guess). Coordinates are 0–1 across the picture.
create or replace function public.hot_cold_probe(p_day int, p_x float8, p_y float8)
returns text
language plpgsql stable security definer
set search_path = ''
as $$
declare
  e record;
  t_x float8; t_y float8; t_r float8; d float8;
begin
  if auth.uid() is null or (now() < public.unlock_at(p_day) and not public.is_admin()) then
    raise exception 'This day is still locked';
  end if;
  select * into e from public.effective_quest(auth.uid(), p_day);
  if not found or e.kind <> 'hotcold' then
    raise exception 'Not a hot & cold game';
  end if;
  t_x := split_part(e.answers[1], ',', 1)::float8;
  t_y := split_part(e.answers[1], ',', 2)::float8;
  t_r := coalesce(nullif(split_part(e.answers[1], ',', 3), '')::float8, 0.06);
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
revoke execute on function public.hot_cold_probe(int, float8, float8) from public, anon;
grant execute on function public.hot_cold_probe(int, float8, float8) to authenticated;

-- Hangman: positions (0-based, in the normalised answer) where a letter appears.
create or replace function public.hangman_letter(p_day int, p_letter text)
returns int[]
language plpgsql stable security definer
set search_path = ''
as $$
declare
  e record;
  w text;
  l text := lower(left(coalesce(p_letter, ''), 1));
  out int[] := '{}';
  i int;
begin
  if auth.uid() is null or (now() < public.unlock_at(p_day) and not public.is_admin()) then
    raise exception 'This day is still locked';
  end if;
  select * into e from public.effective_quest(auth.uid(), p_day);
  if not found or e.kind <> 'hangman' then
    raise exception 'Not a hangman game';
  end if;
  w := public.normalize_answer(e.answers[1]);
  for i in 1..length(w) loop
    if substr(w, i, 1) = l then
      out := out || (i - 1);
    end if;
  end loop;
  return out;
end
$$;
revoke execute on function public.hangman_letter(int, text) from public, anon;
grant execute on function public.hangman_letter(int, text) to authenticated;

-- ---------------------------------------------------------------- answers (adds hot & cold)
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
    elsif v_kind = 'hotcold' then
      begin
        v_lat := split_part(p_answer, ',', 1)::float8;
        v_lng := split_part(p_answer, ',', 2)::float8;
        t_lat := split_part(e.answers[1], ',', 1)::float8;
        t_lng := split_part(e.answers[1], ',', 2)::float8;
        t_r := coalesce(nullif(split_part(e.answers[1], ',', 3), '')::float8, 0.06);
      exception when others then
        raise exception 'Tap the picture first';
      end;
      v_dist := sqrt(power(v_lat - t_lat, 2) + power(v_lng - t_lng, 2));
      v_correct := v_dist <= t_r;
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

