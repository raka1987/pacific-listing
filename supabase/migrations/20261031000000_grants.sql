-- Pacific Listing: let the website use the tables.
-- Newer Supabase projects no longer open new tables to the website by default,
-- so access is granted here explicitly. Row-level security (set up earlier)
-- still decides which rows each person can see or change.

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

-- Emails, ban reasons and limits stay private: only these profile columns are readable.
revoke select on public.profiles from anon, authenticated;
grant select (id, full_name, avatar_url, phone, whatsapp, country, city, bio, role, is_banned, is_verified, created_at,
              business_name, business_until, plan_id)
  on public.profiles to anon, authenticated;

-- Only the database itself may apply a paid order.
revoke execute on function public.fulfil_order(uuid) from public, anon, authenticated;
