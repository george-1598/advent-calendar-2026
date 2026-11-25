-- Themes unlock in a fixed chain: finding the hidden key day in one theme
-- unlocks the next. 'classic' is always available and never stored.

create table public.theme_unlocks (
  user_id uuid not null references auth.users on delete cascade,
  theme text not null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, theme)
);
alter table public.theme_unlocks enable row level security;
create policy "read own unlocks" on public.theme_unlocks
  for select to authenticated using (user_id = auth.uid());
grant select on public.theme_unlocks to authenticated;
revoke all on public.theme_unlocks from anon;

-- Unlock a theme. Only the next theme in the chain can be unlocked
-- (admins may unlock anything, for testing).
create or replace function public.unlock_theme(p_theme text)
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
  insert into public.theme_unlocks (user_id, theme) values (auth.uid(), p_theme)
    on conflict do nothing;
  return true;
end
$$;

revoke execute on function public.unlock_theme(text) from public, anon;
grant execute on function public.unlock_theme(text) to authenticated;
