-- Pacific Listing: marketing helpers
-- 1. "How did you hear about us?" asked at sign-up (private, for the admin dashboard).
-- 2. Launch offer: feature each person's first ad free for a set number of days.

alter table public.profiles add column if not exists heard_from text;
alter table public.site_settings add column if not exists launch_offer_days integer
  check (launch_offer_days is null or launch_offer_days between 1 and 60);

-- New members: also keep where they heard about us.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone, country, heard_from)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'country',
    left(nullif(trim(new.raw_user_meta_data ->> 'heard_from'), ''), 60)
  );
  return new;
end;
$$;

-- Features someone's first ad when the launch offer is on. Returns true if applied.
create or replace function public.apply_launch_offer(p_listing uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  days integer := (select launch_offer_days from public.site_settings where id = 1);
  l public.listings;
begin
  if days is null or auth.uid() is null then
    return false;
  end if;
  select * into l from public.listings where id = p_listing;
  if l.id is null or l.user_id <> auth.uid() or l.status <> 'active' then
    return false;
  end if;
  if exists (select 1 from public.listings where user_id = auth.uid() and id <> p_listing) then
    return false;
  end if;
  perform set_config('app.trusted_update', 'on', true);
  update public.listings
  set is_featured = true, featured_until = now() + make_interval(days => days)
  where id = p_listing;
  perform set_config('app.trusted_update', '', true);
  return true;
end;
$$;
revoke execute on function public.apply_launch_offer(uuid) from public, anon;
grant execute on function public.apply_launch_offer(uuid) to authenticated;

-- Where new members came from, for the admin dashboard.
create or replace function public.admin_signup_sources()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Not authorised';
  end if;
  return json_build_object(
    'last_30_days', (select coalesce(json_object_agg(src, n), '{}'::json) from (
        select coalesce(heard_from, 'Not answered') src, count(*) n from public.profiles
        where created_at > now() - interval '30 days' group by 1) t),
    'all_time', (select coalesce(json_object_agg(src, n), '{}'::json) from (
        select coalesce(heard_from, 'Not answered') src, count(*) n from public.profiles group by 1) t)
  );
end;
$$;
