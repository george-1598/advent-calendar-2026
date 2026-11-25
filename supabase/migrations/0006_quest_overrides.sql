-- Per-player quests: any field can be overridden for a specific player;
-- empty (null) fields fall back to the default quest. Replaces user_rewards.

create table if not exists public.quest_overrides (
  user_id uuid not null references auth.users on delete cascade,
  day int not null check (day between 1 and 25),
  title text,
  kind text,
  content jsonb,
  answers text[],
  reward text,
  hint text,
  badge_letter text,
  primary key (user_id, day)
);
alter table public.quest_overrides enable row level security;
revoke all on public.quest_overrides from anon, authenticated;

-- Carry over existing per-player gifts.
insert into public.quest_overrides (user_id, day, reward)
  select user_id, day, reward from public.user_rewards
  on conflict (user_id, day) do update set reward = excluded.reward;

-- What a given player sees for a day (null row = no quest for them).
create or replace function public.effective_quest(p_user uuid, p_day int)
returns table (title text, kind text, content jsonb, answers text[], reward text, hint text, badge_letter text)
language sql stable security definer
set search_path = ''
as $$
  select
    coalesce(o.title, q.title),
    coalesce(o.kind, q.kind, 'riddle'),
    coalesce(o.content, q.content, '{}'::jsonb),
    coalesce(o.answers, s.answers),
    coalesce(o.reward, s.reward),
    coalesce(o.hint, s.hint),
    coalesce(o.badge_letter, s.badge_letter)
  from (select p_day as day) d
  left join public.quests q on q.day = d.day
  left join public.quest_secrets s on s.day = d.day
  left join public.quest_overrides o on o.day = d.day and o.user_id = p_user
  where coalesce(o.title, q.title) is not null
$$;
revoke execute on function public.effective_quest(uuid, int) from public, anon, authenticated;

-- The quest the signed-in player sees (only once unlocked; admins anytime).
create or replace function public.get_quest(p_day int)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  e record;
begin
  if auth.uid() is null then
    return null;
  end if;
  if now() < public.unlock_at(p_day) and not public.is_admin() then
    return null;
  end if;
  select * into e from public.effective_quest(auth.uid(), p_day);
  if not found then
    return null;
  end if;
  return jsonb_build_object('day', p_day, 'title', e.title, 'kind', e.kind, 'content', e.content);
end
$$;
revoke execute on function public.get_quest(int) from public, anon;
grant execute on function public.get_quest(int) to authenticated;

create or replace function public.get_my_progress()
returns table (day int, attempts int, solved_at timestamptz, reward text, hint text, badge_letter text)
language sql stable security definer
set search_path = ''
as $$
  select
    p.day,
    p.attempts,
    p.solved_at,
    case when p.solved_at is not null then e.reward end,
    case when p.solved_at is not null or p.attempts >= 3 then e.hint end,
    case when p.solved_at is not null then e.badge_letter end
  from public.progress p
  left join lateral public.effective_quest(p.user_id, p.day) e on true
  where p.user_id = auth.uid()
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
    v_correct := true;
  else
    if v_progress.last_attempt_at > now() - interval '2 seconds' then
      raise exception 'Slow down a little, then try again';
    end if;

    v_correct := public.normalize_answer(p_answer) in (
      select public.normalize_answer(a) from unnest(e.answers) as a
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
    'reward', case when v_correct then e.reward end,
    'hint', case when v_correct or v_progress.attempts >= 3 then e.hint end,
    'badge_letter', case when v_correct then e.badge_letter end
  );
end
$$;

-- ---------------------------------------------------------------- admin

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
        select jsonb_agg(jsonb_build_object(
          'user_id', o.user_id, 'title', o.title, 'kind', o.kind, 'content', o.content,
          'answers', o.answers, 'reward', o.reward, 'hint', o.hint, 'badge_letter', o.badge_letter))
        from public.quest_overrides o where o.day = d), '[]'::jsonb)
    ) order by d)
    from generate_series(1, 25) as d
    left join public.quests q on q.day = d
    left join public.quest_secrets s on s.day = d
  );
end
$$;

-- Save one player's version. Empty values mean "use the default"; all empty removes it.
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
  v_content jsonb := case when coalesce(trim(p_content ->> 'prompt'), '') = '' then null else p_content end;
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
revoke execute on function public.admin_save_override(uuid, int, text, text, jsonb, text[], text, text, text) from public, anon;
grant execute on function public.admin_save_override(uuid, int, text, text, jsonb, text[], text, text, text) to authenticated;

-- Per-player gifts now live in quest_overrides.
drop function if exists public.admin_set_user_reward(uuid, int, text);
drop table if exists public.user_rewards;
