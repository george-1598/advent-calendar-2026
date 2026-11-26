-- Players can change their display name (it appears in {name}, hints,
-- thank-yous and friends' calendars). Profiles stay read-only otherwise.
create or replace function public.update_display_name(p_name text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
begin
  if auth.uid() is null then
    raise exception 'Please sign in first';
  end if;
  if length(v_name) < 1 or length(v_name) > 40 then
    raise exception 'Your name should be 1 to 40 characters';
  end if;
  update public.profiles set display_name = v_name where id = auth.uid();
  return v_name;
end
$$;
revoke execute on function public.update_display_name(text) from public, anon;
grant execute on function public.update_display_name(text) to authenticated;
