-- Admin tools: player stats and a quest editor.
-- Every admin_* function checks is_admin() server-side.

-- ---------------------------------------------------------------- tracking

-- How the theme hunt went: items opened before finding the key, and when it started.
alter table public.theme_unlocks
  add column if not exists attempts int,
  add column if not exists hunt_started_at timestamptz;

-- Presence: last time the app was opened and which theme is in use.
alter table public.profiles
  add column if not exists last_seen_at timestamptz,
  add column if not exists current_theme text;

-- Every answer typed (right or wrong), for the admin's eyes only.
create table if not exists public.guess_log (
  id bigserial primary key,
  user_id uuid not null references auth.users on delete cascade,
  day int not null,
  guess text not null,
  correct boolean not null,
  created_at timestamptz not null default now()
);
alter table public.guess_log enable row level security;
revoke all on public.guess_log from anon, authenticated;

create or replace function public.touch_presence(p_theme text default null)
returns void
language sql security definer
set search_path = ''
as $$
  update public.profiles
    set last_seen_at = now(), current_theme = coalesce(p_theme, current_theme)
    where id = auth.uid()
$$;
revoke execute on function public.touch_presence(text) from public, anon;
grant execute on function public.touch_presence(text) to authenticated;

-- unlock_theme now also records how the hunt went.
drop function if exists public.unlock_theme(text);
create or replace function public.unlock_theme(p_theme text, p_attempts int default null, p_started_at timestamptz default null)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  chain text[] := array['classic', 'presents', 'books', 'village', 'ornaments', 'scratch', 'carousel', 'mailroom', 'crackers', 'musicbox'];
  idx int := array_position(chain, p_theme);
begin
  if auth.uid() is null or idx is null or idx = 1 then
    return false;
  end if;
  if idx > 2
     and not public.is_admin()
     and not exists (select 1 from public.theme_unlocks where user_id = auth.uid() and theme = chain[idx - 1]) then
    return false;
  end if;
  insert into public.theme_unlocks (user_id, theme, attempts, hunt_started_at)
    values (auth.uid(), p_theme, p_attempts, p_started_at)
    on conflict do nothing;
  return true;
end
$$;
revoke execute on function public.unlock_theme(text, int, timestamptz) from public, anon;
grant execute on function public.unlock_theme(text, int, timestamptz) to authenticated;

-- submit_answer: unchanged behaviour, plus logging each guess.
create or replace function public.submit_answer(p_day int, p_answer text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_secret public.quest_secrets;
  v_progress public.progress;
  v_correct boolean;
begin
  if v_uid is null then
    raise exception 'Please sign in first';
  end if;
  if now() < public.unlock_at(p_day) and not public.is_admin() then
    raise exception 'This day is still locked';
  end if;

  select * into v_secret from public.quest_secrets where day = p_day;
  if not found then
    raise exception 'This quest isn''t ready yet';
  end if;

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

    v_correct := public.normalize_answer(p_answer) in (
      select public.normalize_answer(a) from unnest(v_secret.answers) as a
    );

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
    'reward', case when v_correct then coalesce(
      (select ur.reward from public.user_rewards ur where ur.user_id = v_uid and ur.day = p_day),
      v_secret.reward) end,
    'hint', case when v_correct or v_progress.attempts >= 3 then v_secret.hint end,
    'badge_letter', case when v_correct then v_secret.badge_letter end
  );
end
$$;

-- ---------------------------------------------------------------- admin: players

create or replace function public.admin_dashboard()
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;
  return coalesce((
    select jsonb_agg(x.u order by x.created_at)
    from (
      select au.created_at, jsonb_build_object(
        'id', p.id,
        'name', p.display_name,
        'email', au.email,
        'is_admin', p.is_admin,
        'created_at', au.created_at,
        'last_seen_at', p.last_seen_at,
        'current_theme', p.current_theme,
        'progress', coalesce((
          select jsonb_agg(jsonb_build_object('day', pr.day, 'attempts', pr.attempts, 'solved_at', pr.solved_at) order by pr.day)
          from public.progress pr where pr.user_id = p.id), '[]'::jsonb),
        'unlocks', coalesce((
          select jsonb_agg(jsonb_build_object('theme', t.theme, 'unlocked_at', t.unlocked_at, 'attempts', t.attempts, 'started_at', t.hunt_started_at) order by t.unlocked_at)
          from public.theme_unlocks t where t.user_id = p.id), '[]'::jsonb),
        'guesses', coalesce((
          select jsonb_agg(jsonb_build_object('day', g.day, 'guess', g.guess, 'correct', g.correct, 'at', g.created_at) order by g.created_at desc)
          from (select * from public.guess_log gl where gl.user_id = p.id order by gl.created_at desc limit 60) g), '[]'::jsonb)
      ) as u
      from public.profiles p
      join auth.users au on au.id = p.id
    ) x
  ), '[]'::jsonb);
end
$$;

-- ---------------------------------------------------------------- admin: quests

create or replace function public.admin_quests()
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;
  return (
    select jsonb_agg(jsonb_build_object(
      'day', d,
      'unlock_at', public.unlock_at(d),
      'title', q.title,
      'kind', q.kind,
      'content', q.content,
      'answers', s.answers,
      'reward', s.reward,
      'hint', s.hint,
      'badge_letter', s.badge_letter,
      'solved_by', (select count(*) from public.progress pr where pr.day = d and pr.solved_at is not null),
      'overrides', coalesce((
        select jsonb_agg(jsonb_build_object('user_id', ur.user_id, 'reward', ur.reward))
        from public.user_rewards ur where ur.day = d), '[]'::jsonb)
    ) order by d)
    from generate_series(1, 25) as d
    left join public.quests q on q.day = d
    left join public.quest_secrets s on s.day = d
  );
end
$$;

create or replace function public.admin_save_quest(
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
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;
  if p_day not between 1 and 25 then
    raise exception 'Day must be 1–25';
  end if;
  if coalesce(trim(p_title), '') = '' then
    raise exception 'Give the quest a title';
  end if;
  if coalesce(array_length(array_remove(p_answers, ''), 1), 0) = 0 then
    raise exception 'Add at least one accepted answer';
  end if;
  if coalesce(trim(p_reward), '') = '' then
    raise exception 'Describe the gift / surprise';
  end if;

  insert into public.quests (day, title, kind, content)
    values (p_day, trim(p_title), coalesce(nullif(p_kind, ''), 'riddle'), coalesce(p_content, '{}'::jsonb))
    on conflict (day) do update set title = excluded.title, kind = excluded.kind, content = excluded.content;

  insert into public.quest_secrets (day, answers, reward, hint, badge_letter)
    values (p_day, array_remove(p_answers, ''), p_reward, nullif(trim(p_hint), ''), nullif(trim(p_badge_letter), ''))
    on conflict (day) do update set
      answers = excluded.answers, reward = excluded.reward, hint = excluded.hint, badge_letter = excluded.badge_letter;
end
$$;

create or replace function public.admin_delete_quest(p_day int)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;
  delete from public.quests where day = p_day; -- secrets and overrides cascade
end
$$;

create or replace function public.admin_set_user_reward(p_user uuid, p_day int, p_reward text)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;
  if coalesce(trim(p_reward), '') = '' then
    delete from public.user_rewards where user_id = p_user and day = p_day;
  else
    insert into public.user_rewards (user_id, day, reward) values (p_user, p_day, p_reward)
      on conflict (user_id, day) do update set reward = excluded.reward;
  end if;
end
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'admin_dashboard()', 'admin_quests()',
    'admin_save_quest(int, text, text, jsonb, text[], text, text, text)',
    'admin_delete_quest(int)', 'admin_set_user_reward(uuid, int, text)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end
$$;
