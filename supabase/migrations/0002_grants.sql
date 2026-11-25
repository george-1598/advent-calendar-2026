-- Newer Supabase projects don't auto-grant table privileges to API roles.
-- Grant read access only where the app reads directly; row-level security
-- policies still limit which rows each user sees. quest_secrets and
-- user_rewards get no grants at all — only the security-definer functions
-- can read them.

grant usage on schema public to authenticated;

grant select on public.profiles to authenticated;
grant select on public.quests to authenticated;
grant select on public.progress to authenticated;

revoke all on public.quest_secrets from anon, authenticated;
revoke all on public.user_rewards from anon, authenticated;
revoke all on public.profiles, public.quests, public.progress from anon;
