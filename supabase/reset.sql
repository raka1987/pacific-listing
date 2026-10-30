-- Pacific Listing: start the database setup again from scratch.
-- Only for a NEW project with no real users or ads yet. It deletes everything
-- the setup file created. Run this, then run setup.sql again.

do $$ begin perform cron.unschedule('expire-promotions'); exception when others then null; end $$;
drop trigger if exists on_auth_user_created on auth.users;
drop policy if exists "Listing images are public" on storage.objects;
drop policy if exists "Users upload to own folder" on storage.objects;
drop policy if exists "Users delete own images" on storage.objects;

drop schema if exists public cascade;
create schema public;
grant usage on schema public to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;
