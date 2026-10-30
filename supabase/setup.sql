-- Pacific Listing: complete database setup
-- Paste this whole file into Supabase > SQL Editor > New query, then click Run.
-- (Generated from the files in supabase/migrations, in order.)


-- ========== 20261028000000_init.sql ==========
-- Pacific Listing: core schema
-- Run this once in a new Supabase project (SQL Editor -> paste -> Run),
-- or with `npx supabase db push`.

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text not null default '',
  avatar_url text,
  phone text,
  whatsapp text,
  country text,
  city text,
  bio text,
  role text not null default 'user' check (role in ('user', 'admin')),
  is_banned boolean not null default false,
  is_verified boolean not null default false,
  created_at timestamptz not null default now()
);

-- Emails are private: only expose the public columns to API clients.
revoke select on public.profiles from anon, authenticated;
grant select (id, full_name, avatar_url, phone, whatsapp, country, city, bio, role, is_banned, is_verified, created_at)
  on public.profiles to anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and not is_banned
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone, country)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'country'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users may edit their own profile, but only admins may change role/ban/verified.
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() and auth.uid() is not null then
    new.role := old.role;
    new.is_banned := old.is_banned;
    new.is_verified := old.is_verified;
    new.email := old.email;
  end if;
  -- Banning a user takes their live listings down.
  if new.is_banned and not old.is_banned then
    update public.listings set status = 'hidden'
    where user_id = new.id and status in ('active', 'pending', 'sold');
  end if;
  return new;
end;
$$;

create trigger profiles_protect
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

alter table public.profiles enable row level security;

create policy "Profiles are public" on public.profiles
  for select using (true);
create policy "Users update own profile" on public.profiles
  for update using (auth.uid() = id or public.is_admin());

-- ---------------------------------------------------------------------------
-- Site settings (single row)
-- ---------------------------------------------------------------------------
create table public.site_settings (
  id int primary key default 1 check (id = 1),
  require_approval boolean not null default false,
  announcement text,
  updated_at timestamptz not null default now()
);
insert into public.site_settings (id) values (1);

alter table public.site_settings enable row level security;
create policy "Settings are public" on public.site_settings for select using (true);
create policy "Admins edit settings" on public.site_settings for update using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Listings
-- ---------------------------------------------------------------------------
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  description text not null default '' check (char_length(description) <= 5000),
  category text not null,
  price numeric(12, 2) check (price is null or price >= 0),
  price_type text not null default 'fixed' check (price_type in ('fixed', 'negotiable', 'free', 'contact')),
  condition text check (condition in ('new', 'used')),
  country text not null,
  city text,
  images text[] not null default '{}',
  contact_phone text,
  contact_whatsapp text,
  status text not null default 'active' check (status in ('pending', 'active', 'sold', 'hidden', 'rejected')),
  rejection_reason text,
  is_featured boolean not null default false,
  views integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(city, '')), 'C')
  ) stored
);

create index listings_status_created_idx on public.listings (status, created_at desc);
create index listings_category_idx on public.listings (category);
create index listings_country_idx on public.listings (country);
create index listings_user_idx on public.listings (user_id);
create index listings_search_idx on public.listings using gin (search);
create index listings_title_trgm_idx on public.listings using gin (title gin_trgm_ops);

-- Owners can't feature their own ads or self-approve; new ads respect the approval setting.
create or replace function public.guard_listing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Trusted internal updates (e.g. view counter) skip the owner rules.
  if coalesce(current_setting('app.trusted_update', true), '') = 'on' then
    return new;
  end if;
  if public.is_admin() or auth.uid() is null then
    new.updated_at := now();
    return new;
  end if;

  if (select is_banned from public.profiles where id = auth.uid()) then
    raise exception 'Your account has been suspended.';
  end if;

  if tg_op = 'INSERT' then
    new.user_id := auth.uid();
    new.is_featured := false;
    new.views := 0;
    new.status := case when (select require_approval from public.site_settings where id = 1)
                       then 'pending' else 'active' end;
  else
    new.user_id := old.user_id;
    new.is_featured := old.is_featured;
    new.views := old.views;
    new.rejection_reason := old.rejection_reason;
    -- Owners may only toggle between live, sold and hidden.
    if new.status is distinct from old.status then
      if old.status in ('pending', 'rejected')
         or new.status not in ('active', 'sold', 'hidden') then
        new.status := old.status;
      elsif new.status = 'active' and (select require_approval from public.site_settings where id = 1)
            and old.status = 'hidden' then
        new.status := 'pending';
      end if;
    end if;
    -- Editing a rejected ad resubmits it for review.
    if old.status = 'rejected' then
      new.status := 'pending';
      new.rejection_reason := null;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger listings_guard
  before insert or update on public.listings
  for each row execute function public.guard_listing();

alter table public.listings enable row level security;

create policy "Live listings are public" on public.listings
  for select using (status in ('active', 'sold') or user_id = auth.uid() or public.is_admin());
create policy "Users create own listings" on public.listings
  for insert with check (auth.uid() = user_id);
create policy "Owners or admins update listings" on public.listings
  for update using (auth.uid() = user_id or public.is_admin());
create policy "Owners or admins delete listings" on public.listings
  for delete using (auth.uid() = user_id or public.is_admin());

create or replace function public.increment_listing_views(listing_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.trusted_update', 'on', true);
  update public.listings set views = views + 1 where id = listing_id and status = 'active';
  perform set_config('app.trusted_update', '', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Favorites
-- ---------------------------------------------------------------------------
create table public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

alter table public.favorites enable row level security;
create policy "Users see own favorites" on public.favorites for select using (auth.uid() = user_id);
create policy "Users add favorites" on public.favorites for insert with check (auth.uid() = user_id);
create policy "Users remove favorites" on public.favorites for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Reports (flagged listings)
-- ---------------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  reporter_id uuid references public.profiles (id) on delete set null,
  reason text not null,
  details text check (char_length(details) <= 2000),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);

alter table public.reports enable row level security;
create policy "Anyone can report" on public.reports for insert with check (reporter_id is null or reporter_id = auth.uid());
create policy "Admins read reports" on public.reports for select using (public.is_admin());
create policy "Admins update reports" on public.reports for update using (public.is_admin());
create policy "Admins delete reports" on public.reports for delete using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Notice board
-- ---------------------------------------------------------------------------
create table public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.notices enable row level security;
create policy "Published notices are public" on public.notices for select using (is_published or public.is_admin());
create policy "Admins manage notices" on public.notices for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Contact form messages
-- ---------------------------------------------------------------------------
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  name text not null,
  email text not null,
  subject text not null default 'General',
  message text not null check (char_length(message) <= 5000),
  status text not null default 'new' check (status in ('new', 'read', 'archived')),
  created_at timestamptz not null default now()
);

alter table public.contact_messages enable row level security;
create policy "Anyone can send a message" on public.contact_messages for insert with check (user_id is null or user_id = auth.uid());
create policy "Admins read messages" on public.contact_messages for select using (public.is_admin());
create policy "Admins update messages" on public.contact_messages for update using (public.is_admin());
create policy "Admins delete messages" on public.contact_messages for delete using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Admin helpers
-- ---------------------------------------------------------------------------
create or replace function public.admin_users(search text default null)
returns table (
  id uuid, email text, full_name text, phone text, country text, role text,
  is_banned boolean, is_verified boolean, created_at timestamptz, listing_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorised';
  end if;
  return query
    select p.id, p.email, p.full_name, p.phone, p.country, p.role, p.is_banned, p.is_verified, p.created_at,
           (select count(*) from public.listings l where l.user_id = p.id)
    from public.profiles p
    where search is null or search = ''
       or p.full_name ilike '%' || search || '%'
       or p.email ilike '%' || search || '%'
       or p.phone ilike '%' || search || '%'
    order by p.created_at desc
    limit 200;
end;
$$;

create or replace function public.admin_stats()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorised';
  end if;
  return json_build_object(
    'users', (select count(*) from public.profiles),
    'users_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'listings_active', (select count(*) from public.listings where status = 'active'),
    'listings_pending', (select count(*) from public.listings where status = 'pending'),
    'listings_7d', (select count(*) from public.listings where created_at > now() - interval '7 days'),
    'listings_sold', (select count(*) from public.listings where status = 'sold'),
    'reports_open', (select count(*) from public.reports where status = 'open'),
    'messages_new', (select count(*) from public.contact_messages where status = 'new'),
    'by_category', (select coalesce(json_object_agg(category, n), '{}'::json) from (
        select category, count(*) n from public.listings where status = 'active' group by category) c),
    'by_day', (select coalesce(json_agg(json_build_object('day', d, 'n', n) order by d), '[]'::json) from (
        select gs::date d, (select count(*) from public.listings l where l.created_at::date = gs::date) n
        from generate_series(current_date - 13, current_date, interval '1 day') gs) x)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Storage: listing photos and avatars
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-images', 'listing-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Listing images are public" on storage.objects
  for select using (bucket_id = 'listing-images');
create policy "Users upload to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'listing-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users delete own images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'listing-images' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- ========== 20261030000000_revenue.sql ==========
-- Pacific Listing: revenue features and staff roles
-- Paid promotions, posting fees, business subscriptions, banner advertising,
-- payments, staff roles, user notes and an activity log.

-- ---------------------------------------------------------------------------
-- Staff roles
-- ---------------------------------------------------------------------------
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('user', 'admin', 'moderator', 'sales'));

alter table public.profiles
  add column ban_reason text,
  add column ad_limit integer check (ad_limit is null or ad_limit >= 0),
  add column business_name text,
  add column plan_id uuid,
  add column business_until timestamptz;

-- Business name and status are shown publicly; ban reason and limits stay private.
grant select (business_name, business_until, plan_id) on public.profiles to anon, authenticated;

create or replace function public.has_role(roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = any (roles) and not is_banned
  );
$$;

create or replace function public.is_mod() returns boolean language sql stable as $$ select public.has_role(array['admin', 'moderator']) $$;
create or replace function public.is_sales() returns boolean language sql stable as $$ select public.has_role(array['admin', 'sales']) $$;
create or replace function public.is_staff() returns boolean language sql stable as $$ select public.has_role(array['admin', 'moderator', 'sales']) $$;

create or replace function public.is_trusted() returns boolean language sql stable as $$
  select coalesce(current_setting('app.trusted_update', true), '') = 'on'
$$;

-- Moderators share the moderation work; sales staff can view listings and messages.
drop policy "Live listings are public" on public.listings;
create policy "Live listings are public" on public.listings
  for select using (status in ('active', 'sold') or user_id = auth.uid() or public.is_staff());
drop policy "Owners or admins update listings" on public.listings;
create policy "Owners or moderators update listings" on public.listings
  for update using (auth.uid() = user_id or public.is_mod());
drop policy "Owners or admins delete listings" on public.listings;
create policy "Owners or moderators delete listings" on public.listings
  for delete using (auth.uid() = user_id or public.is_mod());

drop policy "Admins read reports" on public.reports;
drop policy "Admins update reports" on public.reports;
drop policy "Admins delete reports" on public.reports;
create policy "Moderators read reports" on public.reports for select using (public.is_mod());
create policy "Moderators update reports" on public.reports for update using (public.is_mod());
create policy "Moderators delete reports" on public.reports for delete using (public.is_mod());

drop policy "Published notices are public" on public.notices;
drop policy "Admins manage notices" on public.notices;
create policy "Published notices are public" on public.notices for select using (is_published or public.is_staff());
create policy "Moderators manage notices" on public.notices for all using (public.is_mod()) with check (public.is_mod());

drop policy "Admins read messages" on public.contact_messages;
drop policy "Admins update messages" on public.contact_messages;
drop policy "Admins delete messages" on public.contact_messages;
create policy "Staff read messages" on public.contact_messages for select using (public.is_staff());
create policy "Staff update messages" on public.contact_messages for update using (public.is_staff());
create policy "Staff delete messages" on public.contact_messages for delete using (public.is_staff());

drop policy "Users delete own images" on storage.objects;
create policy "Users delete own images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'listing-images' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_mod()));

-- ---------------------------------------------------------------------------
-- Prices are stored per currency, e.g. {"FJD": 15, "WST": 18}
-- ---------------------------------------------------------------------------
create or replace function public.currency_for(country text)
returns text
language sql
immutable
as $$
  select case country
    when 'FJ' then 'FJD' when 'WS' then 'WST' when 'TO' then 'TOP' when 'VU' then 'VUV'
    when 'SB' then 'SBD' when 'PG' then 'PGK'
    when 'KI' then 'AUD' when 'TV' then 'AUD' when 'NR' then 'AUD'
    when 'CK' then 'NZD' when 'NU' then 'NZD'
    when 'NC' then 'XPF' when 'PF' then 'XPF'
    else 'USD' end
$$;

-- Example prices converted from Fiji dollars at approximate rates, rounded.
create or replace function public.example_prices(fjd numeric)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'FJD', fjd, 'WST', round(fjd * 1.2), 'TOP', round(fjd * 1.05), 'VUV', round(fjd * 53 / 100) * 100,
    'SBD', round(fjd * 3.7), 'PGK', round(fjd * 1.7), 'AUD', greatest(1, round(fjd * 0.68)),
    'NZD', greatest(1, round(fjd * 0.74)), 'XPF', round(fjd * 50 / 100) * 100, 'USD', greatest(1, round(fjd * 0.44)))
$$;

-- ---------------------------------------------------------------------------
-- Paid promotions (sellers buy these for an ad)
-- ---------------------------------------------------------------------------
create table public.boost_packages (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('featured', 'bump', 'urgent')),
  name text not null,
  description text not null default '',
  duration_days integer check (duration_days is null or duration_days > 0),
  prices jsonb not null default '{}',
  is_active boolean not null default true,
  sort integer not null default 0
);

insert into public.boost_packages (kind, name, description, duration_days, prices, sort) values
  ('featured', 'Featured · 7 days', 'Shown on the homepage and at the top of its category.', 7, public.example_prices(15), 1),
  ('featured', 'Featured · 30 days', 'A month on the homepage and at the top of its category.', 30, public.example_prices(45), 2),
  ('bump', 'Bump to top', 'Moves your ad back to the top of the newest ads.', null, public.example_prices(5), 3),
  ('urgent', 'Urgent badge · 7 days', 'A bright "Urgent" label so buyers know you want a quick sale.', 7, public.example_prices(8), 4);

-- Optional fees to post in some categories
create table public.category_fees (
  category text primary key,
  prices jsonb not null default '{}',
  is_active boolean not null default false
);

insert into public.category_fees (category, prices, is_active) values
  ('property', public.example_prices(10), true),
  ('jobs', public.example_prices(10), true),
  ('vehicles', public.example_prices(5), false);

-- ---------------------------------------------------------------------------
-- Business accounts (monthly subscriptions)
-- ---------------------------------------------------------------------------
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  features text[] not null default '{}',
  prices jsonb not null default '{}',
  duration_days integer not null default 30 check (duration_days > 0),
  max_active_ads integer check (max_active_ads is null or max_active_ads >= 0),
  free_bumps integer not null default 0 check (free_bumps >= 0),
  waive_posting_fees boolean not null default true,
  is_active boolean not null default true,
  sort integer not null default 0
);

insert into public.plans (name, description, features, prices, max_active_ads, free_bumps, sort) values
  ('Business Starter', 'For small shops, sole traders and agents getting started.',
   array['Up to 50 live ads', '5 free bumps every month', 'No posting fees', 'Business badge and shop page'],
   public.example_prices(49), 50, 5, 1),
  ('Business Pro', 'For car yards, real estate agencies and busy stores.',
   array['Unlimited live ads', '20 free bumps every month', 'No posting fees', 'Business badge and shop page', 'Priority support'],
   public.example_prices(129), null, 20, 2);

alter table public.profiles add constraint profiles_plan_fk foreign key (plan_id) references public.plans (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Banner advertising
-- ---------------------------------------------------------------------------
create table public.ad_slots (
  code text primary key,
  name text not null,
  description text not null default '',
  size_hint text not null default '',
  prices jsonb not null default '{}', -- per week
  is_active boolean not null default true,
  sort integer not null default 0
);

insert into public.ad_slots (code, name, description, size_hint, prices, sort) values
  ('home_banner', 'Homepage banner', 'Wide banner in the middle of the homepage, seen by almost every visitor.', '1600 × 400 px', public.example_prices(150), 1),
  ('category_top', 'Category & search banner', 'Above the results on category and search pages. Can target specific categories.', '1600 × 300 px', public.example_prices(80), 2),
  ('listing_sidebar', 'Listing page sidebar', 'Beside every ad, next to the seller''s contact buttons.', '800 × 600 px', public.example_prices(60), 3);

create table public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  advertiser_name text not null,
  advertiser_email text,
  advertiser_phone text,
  title text not null,
  image_url text,
  link_url text,
  slot_code text not null references public.ad_slots (code),
  countries text[] not null default '{}',
  categories text[] not null default '{}',
  starts_on date not null default current_date,
  ends_on date not null default current_date + 30,
  status text not null default 'draft' check (status in ('draft', 'awaiting_payment', 'active', 'paused', 'ended')),
  amount numeric(12, 2),
  currency text not null default 'FJD',
  impressions integer not null default 0,
  clicks integer not null default 0,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

-- ---------------------------------------------------------------------------
-- Orders and payments
-- ---------------------------------------------------------------------------
create sequence public.order_number_seq start 10001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('PL-' || nextval('public.order_number_seq')),
  user_id uuid references public.profiles (id) on delete set null,
  kind text not null check (kind in ('boost', 'subscription', 'campaign', 'posting_fee')),
  description text not null,
  listing_id uuid references public.listings (id) on delete set null,
  package_id uuid references public.boost_packages (id) on delete set null,
  plan_id uuid references public.plans (id) on delete set null,
  campaign_id uuid references public.ad_campaigns (id) on delete set null,
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null,
  method text check (method in ('mpaisa', 'mycash', 'bank', 'card', 'cash', 'invoice', 'free')),
  status text not null default 'awaiting_payment' check (status in ('awaiting_payment', 'paid', 'cancelled', 'refunded')),
  payer_reference text,
  billing_name text,
  billing_email text,
  admin_note text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index orders_status_idx on public.orders (status, created_at desc);
create index orders_user_idx on public.orders (user_id);

-- ---------------------------------------------------------------------------
-- Listings: promotion fields, sort order, and a status for unpaid posting fees
-- ---------------------------------------------------------------------------
alter table public.listings
  add column featured_until timestamptz,
  add column is_urgent boolean not null default false,
  add column urgent_until timestamptz,
  add column sort_at timestamptz not null default now();
update public.listings set sort_at = created_at;
create index listings_status_sort_idx on public.listings (status, sort_at desc);

alter table public.listings drop constraint listings_status_check;
alter table public.listings add constraint listings_status_check
  check (status in ('awaiting_payment', 'pending', 'active', 'sold', 'hidden', 'rejected'));

alter table public.site_settings
  add column free_ad_limit integer check (free_ad_limit is null or free_ad_limit >= 0),
  add column payment_details jsonb not null default '{}',
  add column card_payments_enabled boolean not null default false;

update public.site_settings set
  free_ad_limit = 10,
  payment_details = jsonb_build_object(
    'mpaisa_number', '', 'mycash_number', '', 'bank_name', '', 'bank_account_name', '',
    'bank_account_number', '', 'bank_branch', '', 'instructions', 'Use your order number as the payment reference.');

-- Is this user's business subscription current?
create or replace function public.business_plan(uid uuid)
returns public.plans
language sql
stable
security definer
set search_path = public
as $$
  select pl.* from public.profiles p join public.plans pl on pl.id = p.plan_id
  where p.id = uid and p.business_until > now()
$$;

create or replace function public.guard_listing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  plan public.plans;
  lim integer;
  live integer;
  fee_due boolean;
begin
  -- Trusted internal updates (view counter, payments) skip the owner rules.
  if public.is_trusted() then
    return new;
  end if;
  if public.is_mod() or auth.uid() is null then
    new.updated_at := now();
    if tg_op = 'INSERT' then
      new.sort_at := coalesce(new.sort_at, now());
    end if;
    return new;
  end if;

  if (select is_banned from public.profiles where id = auth.uid()) then
    raise exception 'Your account has been suspended.';
  end if;

  if tg_op = 'INSERT' then
    new.user_id := auth.uid();
    new.is_featured := false;
    new.featured_until := null;
    new.is_urgent := false;
    new.urgent_until := null;
    new.views := 0;
    new.sort_at := now();

    -- Live-ad limit: per-user override, then business plan, then the site default.
    plan := public.business_plan(auth.uid());
    select coalesce(p.ad_limit, case when plan.id is not null then plan.max_active_ads
                                     else (select free_ad_limit from public.site_settings where id = 1) end)
      into lim
      from public.profiles p where p.id = auth.uid();
    if lim is not null then
      select count(*) into live from public.listings
      where user_id = auth.uid() and status in ('active', 'pending', 'awaiting_payment');
      if live >= lim then
        raise exception 'You have reached your limit of % live ads. Mark sold items as sold, or upgrade to a Business account to post more.', lim;
      end if;
    end if;

    fee_due := exists (select 1 from public.category_fees where category = new.category and is_active)
               and not coalesce(plan.waive_posting_fees, false);
    new.status := case
      when fee_due then 'awaiting_payment'
      when (select require_approval from public.site_settings where id = 1) then 'pending'
      else 'active' end;
  else
    new.user_id := old.user_id;
    new.is_featured := old.is_featured;
    new.featured_until := old.featured_until;
    new.is_urgent := old.is_urgent;
    new.urgent_until := old.urgent_until;
    new.sort_at := old.sort_at;
    new.views := old.views;
    new.rejection_reason := old.rejection_reason;
    -- Owners may only toggle between live, sold and hidden.
    if new.status is distinct from old.status then
      if old.status in ('pending', 'rejected', 'awaiting_payment')
         or new.status not in ('active', 'sold', 'hidden') then
        new.status := old.status;
      elsif new.status = 'active' and (select require_approval from public.site_settings where id = 1)
            and old.status = 'hidden' then
        new.status := 'pending';
      end if;
    end if;
    -- Editing a rejected ad resubmits it for review.
    if old.status = 'rejected' then
      new.status := 'pending';
      new.rejection_reason := null;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- Creates the order for a posting fee as soon as the ad is saved.
create or replace function public.create_posting_fee_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cur text := public.currency_for(new.country);
  amt numeric;
begin
  if new.status = 'awaiting_payment' then
    select (prices ->> cur)::numeric into amt from public.category_fees where category = new.category;
    insert into public.orders (user_id, kind, description, listing_id, amount, currency)
    values (new.user_id, 'posting_fee', 'Posting fee: ' || new.title, new.id, coalesce(amt, 0), cur);
  end if;
  return new;
end;
$$;

create trigger listings_posting_fee
  after insert on public.listings
  for each row execute function public.create_posting_fee_order();

-- Users can't grant themselves business status, limits or a role.
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_trusted() and not public.is_admin() and auth.uid() is not null then
    new.role := old.role;
    new.is_banned := old.is_banned;
    new.ban_reason := old.ban_reason;
    new.is_verified := old.is_verified;
    new.email := old.email;
    new.ad_limit := old.ad_limit;
    new.plan_id := old.plan_id;
    new.business_until := old.business_until;
    if old.business_until is null or old.business_until < now() then
      new.business_name := old.business_name;
    end if;
  end if;
  -- Banning a user takes their live listings down.
  if new.is_banned and not old.is_banned then
    perform set_config('app.trusted_update', 'on', true);
    update public.listings set status = 'hidden'
    where user_id = new.id and status in ('active', 'pending', 'sold', 'awaiting_payment');
    perform set_config('app.trusted_update', '', true);
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Security rules for the new tables
-- ---------------------------------------------------------------------------
alter table public.boost_packages enable row level security;
create policy "Active packages are public" on public.boost_packages for select using (is_active or public.is_sales());
create policy "Sales manage packages" on public.boost_packages for all using (public.is_sales()) with check (public.is_sales());

alter table public.category_fees enable row level security;
create policy "Fees are public" on public.category_fees for select using (true);
create policy "Sales manage fees" on public.category_fees for all using (public.is_sales()) with check (public.is_sales());

alter table public.plans enable row level security;
create policy "Active plans are public" on public.plans for select using (is_active or public.is_sales());
create policy "Sales manage plans" on public.plans for all using (public.is_sales()) with check (public.is_sales());

alter table public.ad_slots enable row level security;
create policy "Ad slots are public" on public.ad_slots for select using (is_active or public.is_sales());
create policy "Sales manage ad slots" on public.ad_slots for all using (public.is_sales()) with check (public.is_sales());

-- Campaigns hold advertiser contact details and prices, so only staff read the table.
-- Visitors get ads through get_ad() below.
alter table public.ad_campaigns enable row level security;
create policy "Sales manage campaigns" on public.ad_campaigns for all using (public.is_sales()) with check (public.is_sales());

alter table public.orders enable row level security;
create policy "Users see own orders" on public.orders for select using (user_id = auth.uid() or public.is_sales());
create policy "Sales update orders" on public.orders for update using (public.is_sales());
create policy "Sales create orders" on public.orders for insert with check (public.is_sales());

-- ---------------------------------------------------------------------------
-- Ordering and paying (called by signed-in users)
-- ---------------------------------------------------------------------------
create or replace function public.create_boost_order(p_listing uuid, p_package uuid, p_method text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  l public.listings;
  pkg public.boost_packages;
  plan public.plans;
  cur text;
  amt numeric;
  used integer;
  oid uuid;
begin
  select * into l from public.listings where id = p_listing;
  if l.id is null or l.user_id <> auth.uid() then raise exception 'Ad not found.'; end if;
  if l.status <> 'active' then raise exception 'Only live ads can be promoted.'; end if;
  select * into pkg from public.boost_packages where id = p_package and is_active;
  if pkg.id is null then raise exception 'That promotion is not available.'; end if;
  cur := public.currency_for(l.country);
  amt := (pkg.prices ->> cur)::numeric;
  if amt is null then raise exception 'That promotion is not available in your country yet.'; end if;

  -- Business accounts get a number of free bumps each period.
  plan := public.business_plan(auth.uid());
  if pkg.kind = 'bump' and plan.id is not null and plan.free_bumps > 0 then
    select count(*) into used from public.orders
    where user_id = auth.uid() and kind = 'boost' and method = 'free' and status = 'paid'
      and created_at > (select business_until from public.profiles where id = auth.uid()) - make_interval(days => plan.duration_days);
    if used < plan.free_bumps then
      insert into public.orders (user_id, kind, description, listing_id, package_id, amount, currency, method)
      values (auth.uid(), 'boost', pkg.name || ': ' || l.title, l.id, pkg.id, 0, cur, 'free')
      returning id into oid;
      perform public.fulfil_order(oid);
      return oid;
    end if;
  end if;

  if p_method not in ('mpaisa', 'mycash', 'bank', 'card') then raise exception 'Choose a payment method.'; end if;
  insert into public.orders (user_id, kind, description, listing_id, package_id, amount, currency, method)
  values (auth.uid(), 'boost', pkg.name || ': ' || l.title, l.id, pkg.id, amt, cur, p_method)
  returning id into oid;
  return oid;
end;
$$;

create or replace function public.create_subscription_order(p_plan uuid, p_method text, p_business_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  pl public.plans;
  cur text;
  amt numeric;
  oid uuid;
begin
  if auth.uid() is null then raise exception 'Please log in.'; end if;
  select * into pl from public.plans where id = p_plan and is_active;
  if pl.id is null then raise exception 'That plan is not available.'; end if;
  if coalesce(trim(p_business_name), '') = '' then raise exception 'Enter your business name.'; end if;
  if p_method not in ('mpaisa', 'mycash', 'bank', 'card') then raise exception 'Choose a payment method.'; end if;
  cur := public.currency_for(coalesce((select country from public.profiles where id = auth.uid()), 'FJ'));
  amt := (pl.prices ->> cur)::numeric;
  if amt is null then raise exception 'That plan is not available in your country yet.'; end if;
  insert into public.orders (user_id, kind, description, plan_id, amount, currency, method, billing_name, billing_email)
  values (auth.uid(), 'subscription', pl.name || ' · ' || pl.duration_days || ' days', pl.id, amt, cur, p_method,
          trim(p_business_name), (select email from public.profiles where id = auth.uid()))
  returning id into oid;
  return oid;
end;
$$;

-- The buyer tells us how they paid (e.g. the M-PAiSA transaction ID).
create or replace function public.submit_payment(p_order uuid, p_method text, p_reference text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_method not in ('mpaisa', 'mycash', 'bank', 'card') then raise exception 'Choose a payment method.'; end if;
  if coalesce(trim(p_reference), '') = '' then raise exception 'Enter the transaction or receipt number.'; end if;
  update public.orders set method = p_method, payer_reference = left(trim(p_reference), 120)
  where id = p_order and user_id = auth.uid() and status = 'awaiting_payment';
  if not found then raise exception 'Order not found.'; end if;
end;
$$;

create or replace function public.cancel_my_order(p_order uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.orders set status = 'cancelled'
  where id = p_order and user_id = auth.uid() and status = 'awaiting_payment' and kind <> 'posting_fee';
end;
$$;

-- Applies what was bought. Runs when an order is marked paid.
create or replace function public.fulfil_order(p_order uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders;
  pkg public.boost_packages;
  pl public.plans;
begin
  select * into o from public.orders where id = p_order;
  perform set_config('app.trusted_update', 'on', true);
  update public.orders set status = 'paid', paid_at = coalesce(paid_at, now()) where id = o.id;

  if o.kind = 'boost' then
    select * into pkg from public.boost_packages where id = o.package_id;
    if pkg.kind = 'featured' then
      update public.listings
      set is_featured = true,
          featured_until = greatest(coalesce(featured_until, now()), now()) + make_interval(days => pkg.duration_days)
      where id = o.listing_id;
    elsif pkg.kind = 'urgent' then
      update public.listings
      set is_urgent = true,
          urgent_until = greatest(coalesce(urgent_until, now()), now()) + make_interval(days => pkg.duration_days)
      where id = o.listing_id;
    elsif pkg.kind = 'bump' then
      update public.listings set sort_at = now() where id = o.listing_id;
    end if;
  elsif o.kind = 'subscription' then
    select * into pl from public.plans where id = o.plan_id;
    update public.profiles
    set plan_id = pl.id,
        business_until = greatest(coalesce(business_until, now()), now()) + make_interval(days => pl.duration_days),
        business_name = coalesce(o.billing_name, business_name)
    where id = o.user_id;
  elsif o.kind = 'campaign' then
    update public.ad_campaigns set status = 'active' where id = o.campaign_id and status in ('draft', 'awaiting_payment', 'paused');
  elsif o.kind = 'posting_fee' then
    update public.listings
    set status = case when (select require_approval from public.site_settings where id = 1) then 'pending' else 'active' end,
        sort_at = now()
    where id = o.listing_id and status = 'awaiting_payment';
  end if;
  perform set_config('app.trusted_update', '', true);
end;
$$;
revoke execute on function public.fulfil_order(uuid) from public, anon, authenticated;

create or replace function public.admin_mark_order_paid(p_order uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_sales() then raise exception 'Not authorised'; end if;
  if not exists (select 1 from public.orders where id = p_order and status = 'awaiting_payment') then
    raise exception 'This order is not awaiting payment.';
  end if;
  update public.orders set admin_note = coalesce(nullif(trim(p_note), ''), admin_note) where id = p_order;
  perform public.fulfil_order(p_order);
end;
$$;

-- Ends promotions and campaigns whose time is up. Scheduled below, and also
-- safe to call any time.
create or replace function public.expire_promotions()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.trusted_update', 'on', true);
  update public.listings set is_featured = false, featured_until = null where featured_until < now();
  update public.listings set is_urgent = false, urgent_until = null where urgent_until < now();
  perform set_config('app.trusted_update', '', true);
  update public.ad_campaigns set status = 'ended' where status = 'active' and ends_on < current_date;
end;
$$;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('expire-promotions', '*/15 * * * *', 'select public.expire_promotions()');
exception when others then
  raise notice 'pg_cron not available; enable it under Database > Extensions, then run: select cron.schedule(''expire-promotions'', ''*/15 * * * *'', ''select public.expire_promotions()'');';
end;
$$;

-- ---------------------------------------------------------------------------
-- Showing ads to visitors
-- ---------------------------------------------------------------------------
create or replace function public.get_ad(p_slot text, p_country text default null, p_category text default null)
returns table (id uuid, title text, image_url text, link_url text, advertiser_name text)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.title, c.image_url, c.link_url, c.advertiser_name
  from public.ad_campaigns c
  where c.slot_code = p_slot and c.status = 'active'
    and current_date between c.starts_on and c.ends_on
    and (cardinality(c.countries) = 0 or p_country is null or p_country = any (c.countries))
    and (cardinality(c.categories) = 0 or p_category is null or p_category = any (c.categories))
  order by random()
  limit 1
$$;

create or replace function public.record_ad_impression(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.ad_campaigns set impressions = impressions + 1 where id = p_id and status = 'active';
$$;

create or replace function public.record_ad_click(p_id uuid)
returns text
language sql
security definer
set search_path = public
as $$
  update public.ad_campaigns set clicks = clicks + 1 where id = p_id and status = 'active' returning link_url;
$$;

-- ---------------------------------------------------------------------------
-- Staff notes on users, and an activity log
-- ---------------------------------------------------------------------------
create table public.user_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
alter table public.user_notes enable row level security;
create policy "Staff read notes" on public.user_notes for select using (public.is_staff());
create policy "Staff add notes" on public.user_notes for insert with check (public.is_staff() and author_id = auth.uid());
create policy "Admins delete notes" on public.user_notes for delete using (public.is_admin());

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  details jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log (created_at desc);
alter table public.audit_log enable row level security;
create policy "Staff write the log" on public.audit_log for insert with check (public.is_staff() and actor_id = auth.uid());
create policy "Admins read the log" on public.audit_log for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Admin reporting
-- ---------------------------------------------------------------------------
create or replace function public.admin_stats()
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
    'users', (select count(*) from public.profiles),
    'users_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'listings_active', (select count(*) from public.listings where status = 'active'),
    'listings_pending', (select count(*) from public.listings where status = 'pending'),
    'listings_7d', (select count(*) from public.listings where created_at > now() - interval '7 days'),
    'listings_sold', (select count(*) from public.listings where status = 'sold'),
    'reports_open', (select count(*) from public.reports where status = 'open'),
    'messages_new', (select count(*) from public.contact_messages where status = 'new'),
    'by_category', (select coalesce(json_object_agg(category, n), '{}'::json) from (
        select category, count(*) n from public.listings where status = 'active' group by category) c),
    'by_day', (select coalesce(json_agg(json_build_object('day', d, 'n', n) order by d), '[]'::json) from (
        select gs::date d, (select count(*) from public.listings l where l.created_at::date = gs::date) n
        from generate_series(current_date - 13, current_date, interval '1 day') gs) x)
  );
end;
$$;

create or replace function public.admin_revenue()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_sales() then
    raise exception 'Not authorised';
  end if;
  return json_build_object(
    'this_month', (select coalesce(json_object_agg(currency, total), '{}'::json) from (
        select currency, sum(amount) total from public.orders
        where status = 'paid' and paid_at >= date_trunc('month', now()) group by currency) t),
    'last_month', (select coalesce(json_object_agg(currency, total), '{}'::json) from (
        select currency, sum(amount) total from public.orders
        where status = 'paid' and paid_at >= date_trunc('month', now()) - interval '1 month'
          and paid_at < date_trunc('month', now()) group by currency) t),
    'by_kind', (select coalesce(json_object_agg(kind, total), '{}'::json) from (
        select kind, sum(amount) total from public.orders
        where status = 'paid' and currency = 'FJD' and paid_at >= date_trunc('month', now()) group by kind) t),
    'by_month', (select coalesce(json_agg(json_build_object('month', m, 'total', total) order by m), '[]'::json) from (
        select to_char(gs, 'YYYY-MM') m,
               (select coalesce(sum(amount), 0) from public.orders o
                where o.status = 'paid' and o.currency = 'FJD' and date_trunc('month', o.paid_at) = gs) total
        from generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') gs) x),
    'awaiting', (select count(*) from public.orders where status = 'awaiting_payment'),
    'awaiting_with_reference', (select count(*) from public.orders where status = 'awaiting_payment' and payer_reference is not null),
    'campaigns_active', (select count(*) from public.ad_campaigns where status = 'active' and current_date between starts_on and ends_on),
    'businesses', (select count(*) from public.profiles where business_until > now()),
    'promoted', (select count(*) from public.listings where status = 'active' and (is_featured or is_urgent))
  );
end;
$$;

-- Everything staff need on one user's page, including private fields.
create or replace function public.admin_user_detail(p_id uuid)
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
  return (
    select row_to_json(x) from (
      select p.id, p.email, p.full_name, p.phone, p.whatsapp, p.country, p.city, p.bio, p.avatar_url, p.role,
             p.is_banned, p.ban_reason, p.is_verified, p.ad_limit, p.business_name, p.business_until, p.created_at,
             pl.name as plan_name,
             (select count(*) from public.listings l where l.user_id = p.id and l.status in ('active', 'pending', 'awaiting_payment')) as live_ads,
             (select count(*) from public.reports r join public.listings l on l.id = r.listing_id where l.user_id = p.id) as reports_against
      from public.profiles p left join public.plans pl on pl.id = p.plan_id
      where p.id = p_id
    ) x
  );
end;
$$;

-- admin_users now also returns business status, for the users list.
drop function public.admin_users(text);
create or replace function public.admin_users(search text default null)
returns table (
  id uuid, email text, full_name text, phone text, country text, role text,
  is_banned boolean, is_verified boolean, created_at timestamptz, listing_count bigint,
  business_name text, business_until timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Not authorised';
  end if;
  return query
    select p.id, p.email, p.full_name, p.phone, p.country, p.role, p.is_banned, p.is_verified, p.created_at,
           (select count(*) from public.listings l where l.user_id = p.id),
           p.business_name, p.business_until
    from public.profiles p
    where search is null or search = ''
       or p.full_name ilike '%' || search || '%'
       or p.email ilike '%' || search || '%'
       or p.phone ilike '%' || search || '%'
       or p.business_name ilike '%' || search || '%'
    order by p.created_at desc
    limit 200;
end;
$$;

-- ========== 20261030010000_location.sql ==========
-- Pacific Listing: location-aware advertising and currencies

-- Banner spots get a second, higher price for campaigns shown in every country.
alter table public.ad_slots add column global_prices jsonb not null default '{}';
update public.ad_slots set global_prices = public.example_prices((prices ->> 'FJD')::numeric * 3);

-- Country-targeted banners only show to visitors in those countries.
-- Global banners (no countries) show everywhere, including when the
-- visitor's country is unknown.
create or replace function public.get_ad(p_slot text, p_country text default null, p_category text default null)
returns table (id uuid, title text, image_url text, link_url text, advertiser_name text)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.title, c.image_url, c.link_url, c.advertiser_name
  from public.ad_campaigns c
  where c.slot_code = p_slot and c.status = 'active'
    and current_date between c.starts_on and c.ends_on
    and (cardinality(c.countries) = 0 or (p_country is not null and p_country = any (c.countries)))
    and (cardinality(c.categories) = 0 or p_category is null or p_category = any (c.categories))
  order by random()
  limit 1
$$;

-- Business plans can be paid in the currency the visitor chose, when the plan
-- has a price in it; otherwise the currency of the member's own country.
drop function public.create_subscription_order(uuid, text, text);
create or replace function public.create_subscription_order(p_plan uuid, p_method text, p_business_name text, p_currency text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  pl public.plans;
  cur text;
  amt numeric;
  oid uuid;
begin
  if auth.uid() is null then raise exception 'Please log in.'; end if;
  select * into pl from public.plans where id = p_plan and is_active;
  if pl.id is null then raise exception 'That plan is not available.'; end if;
  if coalesce(trim(p_business_name), '') = '' then raise exception 'Enter your business name.'; end if;
  if p_method not in ('mpaisa', 'mycash', 'bank', 'card') then raise exception 'Choose a payment method.'; end if;
  cur := case when p_currency is not null and pl.prices ? p_currency then p_currency
              else public.currency_for(coalesce((select country from public.profiles where id = auth.uid()), 'FJ')) end;
  amt := (pl.prices ->> cur)::numeric;
  if amt is null then raise exception 'That plan is not available in your currency yet.'; end if;
  insert into public.orders (user_id, kind, description, plan_id, amount, currency, method, billing_name, billing_email)
  values (auth.uid(), 'subscription', pl.name || ' · ' || pl.duration_days || ' days', pl.id, amt, cur, p_method,
          trim(p_business_name), (select email from public.profiles where id = auth.uid()))
  returning id into oid;
  return oid;
end;
$$;

-- ========== 20261031000000_grants.sql ==========
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

-- ========== 20261101000000_subcategories.sql ==========
-- Pacific Listing: types within categories (e.g. Property > For rent, Vehicles > SUVs & 4x4)
alter table public.listings add column if not exists subcategory text;
create index if not exists listings_category_sub_idx on public.listings (category, subcategory);

-- ========== 20261102000000_delete_account.sql ==========
-- Pacific Listing: let people delete their own account (required by the app stores).
-- Removes the login, profile, ads and saved ads. Payment records are kept for
-- the business's accounts but no longer linked to the person.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Please log in.';
  end if;
  if (select role from public.profiles where id = uid) = 'admin'
     and (select count(*) from public.profiles where role = 'admin' and not is_banned) <= 1 then
    raise exception 'You are the only admin. Make someone else an admin before deleting your account.';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ========== 20261103000000_marketing.sql ==========
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


-- ========== 20261104000000_chat.sql ==========
-- Pacific Listing: in-app chat between buyers and sellers.
-- One conversation per buyer per ad. Only the two people in a chat can read it;
-- moderators can read a chat only after one of them reports it.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings (id) on delete set null,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  -- Copied from the ad so the chat still makes sense after the ad is deleted.
  listing_title text not null,
  listing_image text,
  last_message text,
  last_message_at timestamptz,
  last_sender_id uuid,
  buyer_read_at timestamptz not null default now(),
  seller_read_at timestamptz not null default now(),
  buyer_hidden boolean not null default false,
  seller_hidden boolean not null default false,
  blocked_by uuid,
  created_at timestamptz not null default now(),
  unique (listing_id, buyer_id)
);
create index if not exists conversations_buyer_idx on public.conversations (buyer_id, last_message_at desc);
create index if not exists conversations_seller_idx on public.conversations (seller_id, last_message_at desc);

create table if not exists public.messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists messages_conversation_idx on public.messages (conversation_id, id);
create index if not exists messages_sender_idx on public.messages (sender_id, created_at desc);

-- Chats can be reported as well as ads.
alter table public.reports alter column listing_id drop not null;
alter table public.reports add column if not exists conversation_id uuid references public.conversations (id) on delete cascade;
alter table public.reports drop constraint if exists reports_target_check;
alter table public.reports add constraint reports_target_check check (listing_id is not null or conversation_id is not null);

-- ---------------------------------------------------------------------------
-- Who may read a chat
-- ---------------------------------------------------------------------------
create or replace function public.in_conversation(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.conversations where id = cid and auth.uid() in (buyer_id, seller_id))
$$;

create or replace function public.can_read_conversation(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.in_conversation(cid)
      or (public.is_mod() and exists (select 1 from public.reports where conversation_id = cid))
$$;

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists "People read their own chats" on public.conversations;
create policy "People read their own chats" on public.conversations
  for select using (public.can_read_conversation(id));
drop policy if exists "People read messages in their chats" on public.messages;
create policy "People read messages in their chats" on public.messages
  for select using (public.can_read_conversation(conversation_id));
drop policy if exists "People send messages in their chats" on public.messages;
create policy "People send messages in their chats" on public.messages
  for insert with check (sender_id = auth.uid() and public.in_conversation(conversation_id));

-- Everything else goes through the functions below.
revoke insert, update, delete on public.conversations from anon, authenticated;
revoke update, delete on public.messages from anon, authenticated;
revoke insert on public.messages from anon;

drop policy if exists "Anyone can report" on public.reports;
create policy "Anyone can report" on public.reports for insert with check (
  (reporter_id is null or reporter_id = auth.uid())
  and (conversation_id is null or public.in_conversation(conversation_id))
);

-- ---------------------------------------------------------------------------
-- Sending messages
-- ---------------------------------------------------------------------------
create or replace function public.guard_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.conversations;
begin
  select * into c from public.conversations where id = new.conversation_id;
  if (select is_banned from public.profiles where id = new.sender_id) then
    raise exception 'Your account is suspended.';
  end if;
  if c.blocked_by is not null then
    raise exception 'This chat is blocked, so messages can''t be sent.';
  end if;
  if (select count(*) from public.messages where sender_id = new.sender_id and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'You''re sending messages too quickly. Please wait a minute.';
  end if;
  new.body := btrim(new.body);
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists guard_message on public.messages;
create trigger guard_message before insert on public.messages
  for each row execute function public.guard_message();

create or replace function public.after_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations set
    last_message = left(new.body, 200),
    last_message_at = new.created_at,
    last_sender_id = new.sender_id,
    buyer_hidden = false,
    seller_hidden = false,
    buyer_read_at = case when new.sender_id = buyer_id then new.created_at else buyer_read_at end,
    seller_read_at = case when new.sender_id = seller_id then new.created_at else seller_read_at end
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists after_message on public.messages;
create trigger after_message after insert on public.messages
  for each row execute function public.after_message();

-- ---------------------------------------------------------------------------
-- Functions the website calls
-- ---------------------------------------------------------------------------

-- Opens (or reopens) the chat with the seller of an ad and returns its id.
create or replace function public.start_conversation(p_listing uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  l public.listings;
  cid uuid;
begin
  if uid is null then
    raise exception 'Please log in.';
  end if;
  if (select is_banned from public.profiles where id = uid) then
    raise exception 'Your account is suspended.';
  end if;
  select * into l from public.listings where id = p_listing;
  if l.id is null or l.status not in ('active', 'sold') then
    raise exception 'This ad is no longer available.';
  end if;
  if l.user_id = uid then
    raise exception 'This is your own ad.';
  end if;

  select id into cid from public.conversations where listing_id = p_listing and buyer_id = uid;
  if cid is not null then
    update public.conversations set buyer_hidden = false where id = cid;
    return cid;
  end if;

  if (select count(*) from public.conversations where buyer_id = uid and created_at > now() - interval '1 day') >= 30 then
    raise exception 'You''ve started a lot of chats today. Please try again tomorrow.';
  end if;

  insert into public.conversations (listing_id, buyer_id, seller_id, listing_title, listing_image)
  values (l.id, uid, l.user_id, l.title, l.images[1])
  returning id into cid;
  return cid;
end;
$$;

-- How many chats have a message the person hasn't read yet.
create or replace function public.my_unread_chats()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.conversations
  where last_sender_id is not null and last_sender_id <> auth.uid()
    and ((buyer_id = auth.uid() and not buyer_hidden and last_message_at > buyer_read_at)
      or (seller_id = auth.uid() and not seller_hidden and last_message_at > seller_read_at))
$$;

create or replace function public.mark_chat_read(cid uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.conversations set
    buyer_read_at = case when buyer_id = auth.uid() then now() else buyer_read_at end,
    seller_read_at = case when seller_id = auth.uid() then now() else seller_read_at end
  where id = cid and auth.uid() in (buyer_id, seller_id)
$$;

-- Removes a chat from the person's inbox. It comes back if a new message arrives.
create or replace function public.hide_chat(cid uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.conversations set
    buyer_hidden = buyer_hidden or buyer_id = auth.uid(),
    seller_hidden = seller_hidden or seller_id = auth.uid()
  where id = cid and auth.uid() in (buyer_id, seller_id)
$$;

-- Blocks or unblocks the other person. Only the person who blocked can unblock.
create or replace function public.set_chat_blocked(cid uuid, blocked boolean)
returns void
language sql
security definer
set search_path = public
as $$
  update public.conversations set
    blocked_by = case when blocked then coalesce(blocked_by, auth.uid()) when blocked_by = auth.uid() then null else blocked_by end
  where id = cid and auth.uid() in (buyer_id, seller_id)
$$;

revoke execute on function public.start_conversation(uuid) from public, anon;
revoke execute on function public.my_unread_chats() from public, anon;
revoke execute on function public.mark_chat_read(uuid) from public, anon;
revoke execute on function public.hide_chat(uuid) from public, anon;
revoke execute on function public.set_chat_blocked(uuid, boolean) from public, anon;
grant execute on function public.start_conversation(uuid) to authenticated;
grant execute on function public.my_unread_chats() to authenticated;
grant execute on function public.mark_chat_read(uuid) to authenticated;
grant execute on function public.hide_chat(uuid) to authenticated;
grant execute on function public.set_chat_blocked(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Live updates: new messages appear without refreshing the page
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'conversations') then
    alter publication supabase_realtime add table public.conversations;
  end if;
end;
$$;
