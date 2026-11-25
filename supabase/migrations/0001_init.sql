-- Advent Calendar 2026 — initial schema
--
-- Security model
--   * quests         : the puzzle itself; readable only once its day has unlocked.
--   * quest_secrets  : answers, gift text, hint, badge letter; NO direct access.
--   * user_rewards   : optional per-person gift text overriding the default.
--   * progress       : each user's attempts / solves; written only by submit_answer().
-- Answers are checked and gifts revealed only inside security-definer functions,
-- which also enforce the unlock time server-side.

create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------- helpers

create or replace function public.unlock_at(p_day int)
returns timestamptz
language sql stable
set search_path = ''
as $$
  select make_timestamptz(2026, 12, p_day, 0, 0, 0, 'Europe/Bucharest')
$$;

create or replace function public.normalize_answer(p text)
returns text
language sql stable
set search_path = ''
as $$
  select trim(regexp_replace(
    regexp_replace(lower(extensions.unaccent(coalesce(p, ''))), '[^a-z0-9 ]', ' ', 'g'),
    '\s+', ' ', 'g'))
$$;

-- ---------------------------------------------------------------- profiles

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null default '',
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "read own profile" on public.profiles
  for select to authenticated using (id = auth.uid());

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1))
  );
  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

-- ---------------------------------------------------------------- quests

create table public.quests (
  day int primary key check (day between 1 and 25),
  title text not null,
  kind text not null default 'riddle',
  content jsonb not null default '{}'::jsonb
);
alter table public.quests enable row level security;
create policy "read unlocked quests" on public.quests
  for select to authenticated
  using (now() >= public.unlock_at(day) or public.is_admin());

create table public.quest_secrets (
  day int primary key references public.quests on delete cascade,
  answers text[] not null,
  reward text not null,
  hint text,
  badge_letter text
);
alter table public.quest_secrets enable row level security;
-- intentionally no policies: only reachable through the functions below

create table public.user_rewards (
  user_id uuid not null references auth.users on delete cascade,
  day int not null references public.quests on delete cascade,
  reward text not null,
  primary key (user_id, day)
);
alter table public.user_rewards enable row level security;
-- intentionally no policies

-- ---------------------------------------------------------------- progress

create table public.progress (
  user_id uuid not null references auth.users on delete cascade,
  day int not null check (day between 1 and 25),
  attempts int not null default 0,
  last_attempt_at timestamptz,
  solved_at timestamptz,
  primary key (user_id, day)
);
alter table public.progress enable row level security;
create policy "read own progress" on public.progress
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------- functions

-- Everything the calendar needs about the current user, in one call.
-- Gift, hint and badge letter are only included once earned.
create or replace function public.get_my_progress()
returns table (
  day int,
  attempts int,
  solved_at timestamptz,
  reward text,
  hint text,
  badge_letter text
)
language sql stable security definer
set search_path = ''
as $$
  select
    p.day,
    p.attempts,
    p.solved_at,
    case when p.solved_at is not null then coalesce(ur.reward, s.reward) end,
    case when p.solved_at is not null or p.attempts >= 3 then s.hint end,
    case when p.solved_at is not null then s.badge_letter end
  from public.progress p
  left join public.quest_secrets s on s.day = p.day
  left join public.user_rewards ur on ur.user_id = p.user_id and ur.day = p.day
  where p.user_id = auth.uid()
$$;

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

revoke execute on function public.get_my_progress() from public, anon;
revoke execute on function public.submit_answer(int, text) from public, anon;
grant execute on function public.get_my_progress() to authenticated;
grant execute on function public.submit_answer(int, text) to authenticated;
