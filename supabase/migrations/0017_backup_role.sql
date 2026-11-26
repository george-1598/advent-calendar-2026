-- Nightly backups (see the private advent-calendar-2026-backups repo) connect as
-- backup_reader: a login role that can only read. It was created by hand with a
-- generated password (stored only as a GitHub secret):
--   create role backup_reader login password '…' bypassrls;
-- bypassrls lets pg_dump see every row despite row-level security.

grant usage on schema public to backup_reader;
grant select on all tables in schema public to backup_reader;
grant select on all sequences in schema public to backup_reader;
alter default privileges for role postgres in schema public grant select on tables to backup_reader;
alter default privileges for role postgres in schema public grant select on sequences to backup_reader;

-- Account basics for the backup (no password hashes). The "backup" schema isn't
-- exposed through the API; only backup_reader can read it.
create schema if not exists backup;
revoke all on schema backup from public, anon, authenticated;
create or replace view backup.auth_users as
  select id, email, created_at, last_sign_in_at, email_confirmed_at, raw_user_meta_data from auth.users;
revoke all on backup.auth_users from public, anon, authenticated;
grant usage on schema backup to backup_reader;
grant select on backup.auth_users to backup_reader;

-- Undo grants that don't apply (auth schema usage can't be granted here).
revoke select on auth.users, auth.identities from backup_reader;
revoke usage on schema storage from backup_reader;
revoke select on storage.objects, storage.buckets from backup_reader;
