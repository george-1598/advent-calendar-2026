-- Let a user re-lock all their themes (start the theme chain over).
create or replace function public.reset_theme_unlocks()
returns void
language sql security definer
set search_path = ''
as $$
  delete from public.theme_unlocks where user_id = auth.uid()
$$;

revoke execute on function public.reset_theme_unlocks() from public, anon;
grant execute on function public.reset_theme_unlocks() to authenticated;
