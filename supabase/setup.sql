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


-- ========== 20261105000000_traffic.sql ==========
-- Pacific Listing: website traffic for the admin panel (visitors, page views, where they come from).
-- No cookies and no personal data: each visitor is a one-way code that changes every day.

create table if not exists public.page_views (
  id bigint generated always as identity primary key,
  path text not null,
  visitor text not null,
  country text,
  referrer text,
  device text not null default 'phone' check (device in ('phone', 'computer', 'app')),
  created_at timestamptz not null default now()
);
create index if not exists page_views_created_idx on public.page_views (created_at desc);

alter table public.page_views enable row level security;
-- Nobody reads or writes the table directly; the functions below do it.
revoke all on public.page_views from anon, authenticated;

-- Called by the website for each page someone opens.
create or replace function public.track_view(p_path text, p_visitor text, p_country text, p_referrer text, p_device text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.page_views (path, visitor, country, referrer, device)
  select left(p_path, 200), left(p_visitor, 64), upper(left(p_country, 2)), nullif(left(lower(p_referrer), 100), ''),
         case when p_device in ('phone', 'computer', 'app') then p_device else 'phone' end
  where p_path like '/%' and length(p_visitor) between 8 and 64
$$;

-- Everything the Traffic page shows, for the last p_days days (days counted in Fiji time).
create or replace function public.admin_traffic(p_days integer default 30)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  tz constant text := 'Pacific/Fiji';
  today date := (now() at time zone tz)::date;
  n_days integer := greatest(1, least(p_days, 365));
  since timestamptz := ((today - (n_days - 1))::timestamp at time zone tz);
begin
  if not public.is_staff() then
    raise exception 'Not allowed';
  end if;
  return json_build_object(
    'today', (select json_build_object('views', count(*), 'visitors', count(distinct visitor))
              from page_views where created_at >= (today::timestamp at time zone tz)),
    'period', (select json_build_object('views', count(*), 'visitors', count(distinct visitor || (created_at at time zone tz)::date))
               from page_views where created_at >= since),
    'by_day', (select coalesce(json_agg(json_build_object('day', d, 'views', coalesce(v.views, 0), 'visitors', coalesce(v.visitors, 0)) order by d), '[]')
               from generate_series(0, n_days - 1) i
               cross join lateral (select today - (n_days - 1) + i as d) dd
               left join (select (created_at at time zone tz)::date as vday, count(*) as views, count(distinct visitor) as visitors
                          from page_views where created_at >= since group by 1) v on v.vday = dd.d),
    'pages', (select coalesce(json_agg(t), '[]') from (
                select path, count(*) views, count(distinct visitor) visitors from page_views
                where created_at >= since group by path order by 2 desc limit 15) t),
    'countries', (select coalesce(json_agg(t), '[]') from (
                select coalesce(country, '??') country, count(distinct visitor) visitors from page_views
                where created_at >= since group by 1 order by 2 desc limit 12) t),
    'referrers', (select coalesce(json_agg(t), '[]') from (
                select referrer, count(distinct visitor) visitors from page_views
                where created_at >= since and referrer is not null group by 1 order by 2 desc limit 12) t),
    'devices', (select coalesce(json_object_agg(device, n), '{}') from (
                select device, count(distinct visitor) n from page_views where created_at >= since group by 1) t)
  );
end;
$$;

revoke execute on function public.admin_traffic(integer) from public, anon;
grant execute on function public.admin_traffic(integer) to authenticated;
grant execute on function public.track_view(text, text, text, text, text) to anon, authenticated;

-- Keep 13 months of history.
do $$
begin
  perform cron.unschedule('trim-page-views');
exception when others then null;
end;
$$;
select cron.schedule('trim-page-views', '17 3 * * *', $$delete from public.page_views where created_at < now() - interval '400 days'$$);


-- ========== 20261106000000_alerts_and_trust.sql ==========
-- Pacific Listing: email alerts (chat messages, saved searches, price drops),
-- verified sellers and member ratings.
--
-- Emails are sent by the database through Resend. After running this file, save your
-- Resend API key once (SQL Editor):
--   select vault.create_secret('re_your_key_here', 'resend_api_key');

create extension if not exists pg_net;

-- ===========================================================================
-- 1. Email engine
-- ===========================================================================

-- Each member's email choices, and a private code for one-click unsubscribe links.
alter table public.profiles
  add column if not exists notify_chat boolean not null default true,
  add column if not exists notify_alerts boolean not null default true,
  add column if not exists unsubscribe_token uuid not null default gen_random_uuid();

create table if not exists public.email_outbox (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles (id) on delete cascade,
  to_email text not null,
  kind text not null,
  subject text not null,
  html text not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  request_id bigint
);
create index if not exists email_outbox_unsent_idx on public.email_outbox (created_at) where sent_at is null;
alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from anon, authenticated;

create or replace function public.site_url()
returns text language sql immutable as $$ select 'https://www.pacificlisting.com' $$;

create or replace function public.esc(t text)
returns text language sql immutable as $$
  select replace(replace(replace(replace(coalesce(t, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;')
$$;

-- The shared look of every email.
create or replace function public.email_layout(p_heading text, p_body text, p_button text, p_url text, p_footer text)
returns text language sql immutable as $$
  select '<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">'
    || '<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">'
    || '<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;padding:28px">'
    || '<tr><td style="font-size:20px;font-weight:bold;color:#0f766e;padding-bottom:16px">Pacific Listing</td></tr>'
    || '<tr><td style="font-size:20px;font-weight:bold;padding-bottom:12px">' || p_heading || '</td></tr>'
    || '<tr><td style="font-size:15px;line-height:1.5">' || p_body || '</td></tr>'
    || case when p_url is null then '' else
         '<tr><td style="padding-top:20px"><a href="' || p_url || '" style="display:inline-block;background:#0f766e;color:#ffffff;'
         || 'text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:10px">' || p_button || '</a></td></tr>' end
    || '<tr><td style="padding-top:24px;font-size:12px;color:#64748b;line-height:1.5">' || p_footer || '</td></tr>'
    || '</table></td></tr></table></body></html>'
$$;

create or replace function public.unsubscribe_footer(p_token uuid, p_kind text, p_what text)
returns text language sql immutable as $$
  select 'You get this email because ' || p_what || '. '
    || '<a href="' || public.site_url() || '/unsubscribe?t=' || p_token || '&k=' || p_kind || '" style="color:#64748b">Stop these emails</a>'
    || ' · <a href="' || public.site_url() || '/profile" style="color:#64748b">Email settings</a>'
$$;

-- Puts an email in the queue for a member (skipped for banned or deleted members).
create or replace function public.queue_email(p_user uuid, p_kind text, p_subject text, p_html text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.email_outbox (user_id, to_email, kind, subject, html)
  select u.id, u.email, p_kind, p_subject, p_html
  from auth.users u join public.profiles p on p.id = u.id
  where u.id = p_user and u.email is not null and not p.is_banned
$$;

-- Sends queued emails through Resend (at most 50 per run). Does nothing until the key is saved.
create or replace function public.flush_email_outbox()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  api_key text;
  api_url text;
  m record;
  n integer := 0;
begin
  select decrypted_secret into api_key from vault.decrypted_secrets where name = 'resend_api_key';
  if api_key is null then
    return 0;
  end if;
  select coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'resend_api_url'), 'https://api.resend.com/emails')
    into api_url;
  for m in
    select * from public.email_outbox
    where sent_at is null and created_at > now() - interval '2 days'
    order by id limit 50
    for update skip locked
  loop
    update public.email_outbox set sent_at = now(), request_id = net.http_post(
      url := api_url,
      body := jsonb_build_object(
        'from', 'Pacific Listing <no-reply@pacificlisting.com>',
        'to', jsonb_build_array(m.to_email),
        'subject', m.subject,
        'html', m.html),
      headers := jsonb_build_object('Authorization', 'Bearer ' || api_key, 'Content-Type', 'application/json'),
      timeout_milliseconds := 10000)
    where id = m.id;
    n := n + 1;
  end loop;
  delete from public.email_outbox where created_at < now() - interval '30 days';
  return n;
end;
$$;

-- The member's own email choices.
create or replace function public.get_my_notify_prefs()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('chat', notify_chat, 'alerts', notify_alerts) from public.profiles where id = auth.uid()
$$;

create or replace function public.set_my_notify_prefs(p_chat boolean, p_alerts boolean)
returns void language sql security definer set search_path = public as $$
  update public.profiles set notify_chat = p_chat, notify_alerts = p_alerts where id = auth.uid()
$$;

-- One-click unsubscribe from an email link (no login needed).
create or replace function public.unsubscribe(p_token uuid, p_kind text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set
    notify_chat = case when p_kind in ('chat', 'all') then false else notify_chat end,
    notify_alerts = case when p_kind in ('alerts', 'all') then false else notify_alerts end
  where unsubscribe_token = p_token;
  return found;
end;
$$;

-- ===========================================================================
-- 2. Chat message alerts
-- ===========================================================================
-- When a message stays unread for 5 minutes, the other person gets one email.
-- No more emails about that chat until they've read it.

alter table public.conversations
  add column if not exists buyer_alerted_at timestamptz,
  add column if not exists seller_alerted_at timestamptz;

create or replace function public.queue_chat_alerts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  n integer := 0;
  sender_name text;
begin
  for c in
    select conv.*, case when conv.last_sender_id = conv.buyer_id then conv.seller_id else conv.buyer_id end as to_id
    from public.conversations conv
    where conv.last_message_at between now() - interval '1 day' and now() - interval '5 minutes'
      and conv.blocked_by is null
      and conv.last_sender_id is not null
  loop
    -- Unread by the other person, and not already emailed since they last read it.
    if c.to_id = c.buyer_id then
      continue when c.last_message_at <= c.buyer_read_at or (c.buyer_alerted_at is not null and c.buyer_alerted_at > c.buyer_read_at);
    else
      continue when c.last_message_at <= c.seller_read_at or (c.seller_alerted_at is not null and c.seller_alerted_at > c.seller_read_at);
    end if;
    continue when not exists (select 1 from public.profiles where id = c.to_id and notify_chat and not is_banned);

    select coalesce(nullif(case when business_until > now() then business_name end, ''), nullif(full_name, ''), 'A member')
      into sender_name from public.profiles where id = c.last_sender_id;

    perform public.queue_email(
      c.to_id, 'chat',
      'New message from ' || sender_name || ' about "' || left(c.listing_title, 60) || '"',
      public.email_layout(
        'You have a new message',
        '<p style="margin:0 0 12px"><strong>' || public.esc(sender_name) || '</strong> sent you a message about <strong>'
          || public.esc(c.listing_title) || '</strong>:</p>'
          || '<p style="margin:0;padding:12px 14px;background:#f1f5f9;border-radius:10px">' || public.esc(left(c.last_message, 200)) || '</p>',
        'Reply now',
        public.site_url() || '/messages/' || c.id,
        public.unsubscribe_footer((select unsubscribe_token from public.profiles where id = c.to_id), 'chat',
          'someone messaged you on Pacific Listing')));

    if c.to_id = c.buyer_id then
      update public.conversations set buyer_alerted_at = now() where id = c.id;
    else
      update public.conversations set seller_alerted_at = now() where id = c.id;
    end if;
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- ===========================================================================
-- 3. Saved searches and 4. price drops (sent together in one daily email)
-- ===========================================================================

create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  q text,
  category text,
  sub text,
  country text,
  city text,
  min_price numeric,
  max_price numeric,
  condition text,
  alerts boolean not null default true,
  created_at timestamptz not null default now(),
  unique nulls not distinct (user_id, q, category, sub, country, city, min_price, max_price, condition)
);
alter table public.saved_searches enable row level security;
drop policy if exists "Members manage their saved searches" on public.saved_searches;
create policy "Members manage their saved searches" on public.saved_searches
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.limit_saved_searches()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.saved_searches where user_id = new.user_id) >= 20 then
    raise exception 'You can save up to 20 searches. Delete one to save another.';
  end if;
  return new;
end;
$$;
drop trigger if exists limit_saved_searches on public.saved_searches;
create trigger limit_saved_searches before insert on public.saved_searches
  for each row execute function public.limit_saved_searches();

-- New matches and price drops waiting for the daily email.
create table if not exists public.alert_items (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  kind text not null check (kind in ('search', 'price')),
  old_price numeric,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create unique index if not exists alert_items_pending_idx on public.alert_items (user_id, listing_id, kind) where sent_at is null;
alter table public.alert_items enable row level security;
revoke all on public.alert_items from anon, authenticated;

-- Price-drop badge on ads.
alter table public.listings
  add column if not exists previous_price numeric,
  add column if not exists price_dropped_at timestamptz;

create or replace function public.track_price_drop()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.price is distinct from old.price then
    if old.price is not null and new.price is not null and new.price < old.price then
      new.previous_price := old.price;
      new.price_dropped_at := now();
    else
      new.previous_price := null;
      new.price_dropped_at := null;
    end if;
  elsif tg_op = 'UPDATE' then
    new.previous_price := old.previous_price;
    new.price_dropped_at := old.price_dropped_at;
  else
    new.previous_price := null;
    new.price_dropped_at := null;
  end if;
  return new;
end;
$$;
drop trigger if exists track_price_drop on public.listings;
create trigger track_price_drop before insert or update on public.listings
  for each row execute function public.track_price_drop();

-- Finds members to tell about a new ad or a lower price.
create or replace function public.collect_listing_alerts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> 'active' then
    return new;
  end if;

  -- A new ad has gone live: match it against saved searches.
  if (tg_op = 'INSERT' or old.status is distinct from 'active') and new.created_at > now() - interval '3 days' then
    insert into public.alert_items (user_id, listing_id, kind)
    select distinct s.user_id, new.id, 'search'
    from public.saved_searches s join public.profiles p on p.id = s.user_id
    where s.alerts and p.notify_alerts and not p.is_banned and s.user_id <> new.user_id
      and (s.category is null or s.category = new.category)
      and (s.sub is null or s.sub = new.subcategory)
      and (s.country is null or s.country = new.country)
      and (s.city is null or new.city ilike '%' || s.city || '%')
      and (s.min_price is null or new.price >= s.min_price)
      and (s.max_price is null or new.price <= s.max_price)
      and (s.condition is null or s.condition = new.condition)
      and (s.q is null or new.title ilike '%' || s.q || '%' or new.search @@ websearch_to_tsquery('english', s.q))
    on conflict do nothing;
  end if;

  -- The price went down: tell everyone who saved the ad.
  if tg_op = 'UPDATE' and old.price is not null and new.price < old.price then
    insert into public.alert_items (user_id, listing_id, kind, old_price)
    select f.user_id, new.id, 'price', old.price
    from public.favorites f join public.profiles p on p.id = f.user_id
    where f.listing_id = new.id and f.user_id <> new.user_id and p.notify_alerts and not p.is_banned
    on conflict do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists collect_listing_alerts on public.listings;
create trigger collect_listing_alerts after insert or update of status, price on public.listings
  for each row execute function public.collect_listing_alerts();

create or replace function public.country_name(p_code text)
returns text language sql immutable as $$
  select case p_code
    when 'FJ' then 'Fiji' when 'WS' then 'Samoa' when 'TO' then 'Tonga' when 'VU' then 'Vanuatu'
    when 'SB' then 'Solomon Islands' when 'PG' then 'Papua New Guinea' when 'KI' then 'Kiribati'
    when 'TV' then 'Tuvalu' when 'NR' then 'Nauru' when 'CK' then 'Cook Islands' when 'NU' then 'Niue'
    when 'NC' then 'New Caledonia' when 'PF' then 'French Polynesia' when 'AS' then 'American Samoa'
    when 'FM' then 'Micronesia' when 'MH' then 'Marshall Islands' when 'PW' then 'Palau' when 'GU' then 'Guam'
    else p_code end
$$;

create or replace function public.price_text(p_price numeric, p_type text, p_country text)
returns text language sql immutable as $$
  select case when p_type = 'free' then 'Free'
              when p_price is null or p_type = 'contact' then 'Contact seller'
              else public.currency_for(p_country) || ' ' || to_char(p_price, 'FM999,999,999,990') end
$$;

-- One email per member per day with their new matches and price drops.
create or replace function public.send_daily_alerts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  u record;
  items text;
  n_items integer;
  n_search integer;
  n_price integer;
  sent integer := 0;
  subject text;
begin
  -- Drop items whose ad is no longer live, or for members who switched alerts off.
  delete from public.alert_items a
  where a.sent_at is null and (
    not exists (select 1 from public.listings l where l.id = a.listing_id and l.status = 'active')
    or not exists (select 1 from public.profiles p where p.id = a.user_id and p.notify_alerts and not p.is_banned));

  for u in select distinct user_id from public.alert_items where sent_at is null loop
    select count(*), count(*) filter (where kind = 'search'), count(*) filter (where kind = 'price')
      into n_items, n_search, n_price
      from public.alert_items where user_id = u.user_id and sent_at is null;

    select string_agg(
      '<tr><td style="padding:10px 0;border-top:1px solid #e2e8f0">'
      || '<table cellpadding="0" cellspacing="0"><tr>'
      || '<td style="width:72px;vertical-align:top">'
      || case when l.images[1] is not null
           then '<img src="' || public.esc(l.images[1]) || '" width="64" height="64" style="border-radius:8px;object-fit:cover;display:block" alt="">'
           else '' end
      || '</td><td style="vertical-align:top;font-size:14px">'
      || '<a href="' || public.site_url() || '/listing/' || l.id || '" style="color:#0f172a;font-weight:bold;text-decoration:none">'
      || public.esc(l.title) || '</a><br>'
      || '<span style="color:#0f766e;font-weight:bold">' || public.price_text(l.price, l.price_type, l.country) || '</span>'
      || case when a.kind = 'price'
           then ' <span style="color:#64748b;text-decoration:line-through">' || public.price_text(a.old_price, l.price_type, l.country) || '</span>'
                || ' <span style="color:#dc2626;font-weight:bold">Price dropped</span>'
           else '' end
      || '<br><span style="color:#64748b">' || public.esc(coalesce(nullif(l.city, '') || ', ', '')) || public.esc(public.country_name(l.country)) || '</span>'
      || '</td></tr></table></td></tr>', '' order by a.kind desc, a.created_at desc)
    into items
    from (select * from public.alert_items where user_id = u.user_id and sent_at is null order by created_at desc limit 12) a
    join public.listings l on l.id = a.listing_id;

    subject := case
      when n_search > 0 and n_price > 0 then n_search || ' new ' || case when n_search = 1 then 'ad' else 'ads' end
           || ' for your searches, and ' || n_price || ' price ' || case when n_price = 1 then 'drop' else 'drops' end
      when n_search > 0 then n_search || ' new ' || case when n_search = 1 then 'ad matches' else 'ads match' end || ' your saved searches'
      else 'Price ' || case when n_price = 1 then 'drop on an ad' else 'drops on ads' end || ' you saved' end;

    perform public.queue_email(
      u.user_id, 'alerts', subject,
      public.email_layout(
        public.esc(subject),
        '<table width="100%" cellpadding="0" cellspacing="0">' || items || '</table>'
          || case when n_items > 12 then '<p style="color:#64748b">And ' || (n_items - 12) || ' more.</p>' else '' end,
        'See your saved searches',
        public.site_url() || '/saved-searches',
        public.unsubscribe_footer((select unsubscribe_token from public.profiles where id = u.user_id), 'alerts',
          'you saved searches or ads on Pacific Listing')));

    update public.alert_items set sent_at = now() where user_id = u.user_id and sent_at is null;
    sent := sent + 1;
  end loop;
  delete from public.alert_items where sent_at < now() - interval '30 days';
  return sent;
end;
$$;

-- ===========================================================================
-- 5. Verified sellers
-- ===========================================================================

create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  phone text not null check (char_length(phone) between 6 and 30),
  business_name text check (char_length(business_name) <= 100),
  document_path text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reason text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists verification_one_pending_idx on public.verification_requests (user_id) where status = 'pending';
alter table public.verification_requests enable row level security;
drop policy if exists "Members see their requests" on public.verification_requests;
create policy "Members see their requests" on public.verification_requests
  for select using (user_id = auth.uid() or public.is_mod());
drop policy if exists "Members ask to be verified" on public.verification_requests;
create policy "Members ask to be verified" on public.verification_requests
  for insert with check (user_id = auth.uid() and status = 'pending' and reviewed_by is null);
revoke update, delete on public.verification_requests from anon, authenticated;

-- Private storage for ID photos: only the member and moderators can see them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('verification', 'verification', false, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
on conflict (id) do nothing;
drop policy if exists "Members upload their ID" on storage.objects;
create policy "Members upload their ID" on storage.objects for insert to authenticated
  with check (bucket_id = 'verification' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Members and moderators see IDs" on storage.objects;
create policy "Members and moderators see IDs" on storage.objects for select to authenticated
  using (bucket_id = 'verification' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_mod()));
drop policy if exists "Moderators delete IDs" on storage.objects;
create policy "Moderators delete IDs" on storage.objects for delete to authenticated
  using (bucket_id = 'verification' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_mod()));

create or replace function public.review_verification(p_id uuid, p_approve boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.verification_requests;
begin
  if not public.is_mod() then
    raise exception 'Not allowed';
  end if;
  select * into r from public.verification_requests where id = p_id and status = 'pending';
  if r.id is null then
    raise exception 'This request has already been dealt with.';
  end if;
  update public.verification_requests
    set status = case when p_approve then 'approved' else 'rejected' end,
        reason = nullif(trim(p_reason), ''), reviewed_by = auth.uid(), reviewed_at = now(), document_path = null
    where id = p_id;
  if p_approve then
    perform set_config('app.trusted_update', 'on', true);
    update public.profiles set is_verified = true where id = r.user_id;
    perform set_config('app.trusted_update', '', true);
  end if;
  perform public.queue_email(
    r.user_id, 'account',
    case when p_approve then 'You''re now a verified seller' else 'About your verification request' end,
    public.email_layout(
      case when p_approve then 'You''re verified!' else 'We couldn''t verify you yet' end,
      case when p_approve
        then '<p style="margin:0">Your ads and profile now show the <strong>Verified</strong> tick, so buyers know you''re genuine.</p>'
        else '<p style="margin:0">' || public.esc(coalesce(nullif(trim(p_reason), ''), 'We couldn''t check the details you sent.'))
             || '</p><p>You can send a new request at any time.</p>' end,
      case when p_approve then 'See your profile' else 'Try again' end,
      public.site_url() || case when p_approve then '/seller/' || r.user_id else '/verify' end,
      'This is about your Pacific Listing account.'));
end;
$$;

-- ===========================================================================
-- 6. Member ratings
-- ===========================================================================

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  reviewee_id uuid not null references public.profiles (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (reviewer_id, reviewee_id),
  check (reviewer_id <> reviewee_id)
);
create index if not exists reviews_reviewee_idx on public.reviews (reviewee_id, created_at desc);
alter table public.reviews enable row level security;
drop policy if exists "Reviews are public" on public.reviews;
create policy "Reviews are public" on public.reviews for select using (true);
drop policy if exists "Authors or moderators remove reviews" on public.reviews;
create policy "Authors or moderators remove reviews" on public.reviews
  for delete using (reviewer_id = auth.uid() or public.is_mod());
revoke insert, update on public.reviews from anon, authenticated;

create or replace view public.member_ratings with (security_invoker = true) as
  select reviewee_id as member_id, round(avg(rating), 1) as average, count(*)::int as total
  from public.reviews group by reviewee_id;
grant select on public.member_ratings to anon, authenticated;

-- Rate the other person in a chat. Both people must have sent at least one message.
create or replace function public.submit_review(p_conversation uuid, p_rating integer, p_comment text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  c public.conversations;
  other uuid;
begin
  if uid is null then
    raise exception 'Please log in.';
  end if;
  if (select is_banned from public.profiles where id = uid) then
    raise exception 'Your account is suspended.';
  end if;
  select * into c from public.conversations where id = p_conversation and uid in (buyer_id, seller_id);
  if c.id is null then
    raise exception 'Chat not found.';
  end if;
  other := case when uid = c.buyer_id then c.seller_id else c.buyer_id end;
  if not exists (select 1 from public.messages where conversation_id = c.id and sender_id = uid)
     or not exists (select 1 from public.messages where conversation_id = c.id and sender_id = other) then
    raise exception 'You can leave a rating once you''ve both sent messages in this chat.';
  end if;
  if p_rating not between 1 and 5 then
    raise exception 'Choose from 1 to 5 stars.';
  end if;
  insert into public.reviews (reviewer_id, reviewee_id, conversation_id, rating, comment)
  values (uid, other, c.id, p_rating, nullif(left(trim(p_comment), 1000), ''))
  on conflict (reviewer_id, reviewee_id) do update
    set rating = excluded.rating, comment = excluded.comment, conversation_id = excluded.conversation_id, updated_at = now();
end;
$$;

-- ===========================================================================
-- Permissions and schedules
-- ===========================================================================

revoke execute on function public.queue_email(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.flush_email_outbox() from public, anon, authenticated;
revoke execute on function public.queue_chat_alerts() from public, anon, authenticated;
revoke execute on function public.send_daily_alerts() from public, anon, authenticated;
revoke execute on function public.get_my_notify_prefs() from public, anon;
revoke execute on function public.set_my_notify_prefs(boolean, boolean) from public, anon;
revoke execute on function public.review_verification(uuid, boolean, text) from public, anon;
revoke execute on function public.submit_review(uuid, integer, text) from public, anon;
grant execute on function public.get_my_notify_prefs() to authenticated;
grant execute on function public.set_my_notify_prefs(boolean, boolean) to authenticated;
grant execute on function public.review_verification(uuid, boolean, text) to authenticated;
grant execute on function public.submit_review(uuid, integer, text) to authenticated;
grant execute on function public.unsubscribe(uuid, text) to anon, authenticated;

-- Every 2 minutes: chat alerts, then send whatever is queued.
-- Every day at 6pm Fiji time (06:00 UTC): saved search and price drop emails.
do $$
begin
  perform cron.unschedule('email-alerts');
exception when others then null;
end;
$$;
do $$
begin
  perform cron.unschedule('daily-alerts');
exception when others then null;
end;
$$;
select cron.schedule('email-alerts', '*/2 * * * *', $$select public.queue_chat_alerts(); select public.flush_email_outbox();$$);
select cron.schedule('daily-alerts', '0 6 * * *', $$select public.send_daily_alerts(); select public.flush_email_outbox();$$);


-- ========== 20261107000000_support_replies.sql ==========
-- Pacific Listing: reply to contact messages from inside the admin panel.
-- Replies are emailed from support@pacificlisting.com, so the person's answer
-- comes back to the support inbox. Every reply is kept with the message.

create table if not exists public.contact_replies (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.contact_messages (id) on delete cascade,
  staff_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index if not exists contact_replies_message_idx on public.contact_replies (message_id, created_at);
alter table public.contact_replies enable row level security;
drop policy if exists "Staff read replies" on public.contact_replies;
create policy "Staff read replies" on public.contact_replies for select using (public.is_staff());
revoke insert, update, delete on public.contact_replies from anon, authenticated;

-- Emails can now come from a different address (support@) with its own reply-to.
alter table public.email_outbox
  add column if not exists from_address text,
  add column if not exists reply_to text;

create or replace function public.flush_email_outbox()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  api_key text;
  api_url text;
  m record;
  n integer := 0;
begin
  select decrypted_secret into api_key from vault.decrypted_secrets where name = 'resend_api_key';
  if api_key is null then
    return 0;
  end if;
  select coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'resend_api_url'), 'https://api.resend.com/emails')
    into api_url;
  for m in
    select * from public.email_outbox
    where sent_at is null and created_at > now() - interval '2 days'
    order by id limit 50
    for update skip locked
  loop
    update public.email_outbox set sent_at = now(), request_id = net.http_post(
      url := api_url,
      body := jsonb_strip_nulls(jsonb_build_object(
        'from', coalesce(m.from_address, 'Pacific Listing <no-reply@pacificlisting.com>'),
        'to', jsonb_build_array(m.to_email),
        'reply_to', m.reply_to,
        'subject', m.subject,
        'html', m.html)),
      headers := jsonb_build_object('Authorization', 'Bearer ' || api_key, 'Content-Type', 'application/json'),
      timeout_milliseconds := 10000)
    where id = m.id;
    n := n + 1;
  end loop;
  delete from public.email_outbox where created_at < now() - interval '30 days';
  return n;
end;
$$;

-- Saves a staff reply and emails it straight away.
create or replace function public.reply_to_contact(p_message uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.contact_messages;
  staff_name text;
  body text := trim(p_body);
begin
  if not public.is_staff() then
    raise exception 'Not allowed';
  end if;
  if body = '' then
    raise exception 'Write a reply first.';
  end if;
  select * into m from public.contact_messages where id = p_message;
  if m.id is null then
    raise exception 'Message not found.';
  end if;
  select split_part(coalesce(nullif(full_name, ''), 'The Pacific Listing team'), ' ', 1) into staff_name
    from public.profiles where id = auth.uid();

  insert into public.contact_replies (message_id, staff_id, body) values (m.id, auth.uid(), left(body, 5000));
  update public.contact_messages set status = 'read' where id = m.id and status = 'new';

  insert into public.email_outbox (user_id, to_email, kind, subject, html, from_address, reply_to)
  values (
    m.user_id, m.email, 'support',
    'Re: ' || m.subject,
    public.email_layout(
      'Re: ' || public.esc(m.subject),
      '<p style="margin:0 0 16px;white-space:pre-line">' || public.esc(left(body, 5000)) || '</p>'
        || '<p style="margin:0 0 20px">' || public.esc(staff_name) || '<br>Pacific Listing support</p>'
        || '<p style="margin:0;padding:12px 14px;background:#f1f5f9;border-radius:10px;color:#475569;font-size:13px">'
        || '<strong>Your message:</strong><br><span style="white-space:pre-line">' || public.esc(left(m.message, 1500)) || '</span></p>',
      null, null,
      'Just reply to this email to answer us.'),
    'Pacific Listing Support <support@pacificlisting.com>',
    'support@pacificlisting.com');

  perform public.flush_email_outbox();
end;
$$;

revoke execute on function public.flush_email_outbox() from public, anon, authenticated;
revoke execute on function public.reply_to_contact(uuid, text) from public, anon;
grant execute on function public.reply_to_contact(uuid, text) to authenticated;


-- ========== 20261108000000_push.sql ==========
-- Pacific Listing: phone notifications (push) for the Android and iPhone apps.
--
-- The apps register each phone here. When a chat message arrives, the database asks
-- the website (/api/push) to send the notification through Firebase.
-- After running this file, save two settings once (SQL Editor), using the same
-- PUSH_SECRET you put in Vercel:
--   select vault.create_secret('https://www.pacificlisting.com/api/push', 'push_url');
--   select vault.create_secret('YOUR_PUSH_SECRET', 'push_secret');

create extension if not exists pg_net;

create table if not exists public.push_tokens (
  token text primary key check (char_length(token) between 20 and 4096),
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null default 'android' check (platform in ('android', 'ios')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_tokens_user_idx on public.push_tokens (user_id);
alter table public.push_tokens enable row level security;
revoke all on public.push_tokens from anon, authenticated;

-- The app saves its phone's address after the person logs in (moves it if someone else logged in on that phone).
create or replace function public.save_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Please log in.';
  end if;
  insert into public.push_tokens (token, user_id, platform)
  values (p_token, auth.uid(), case when p_platform = 'ios' then 'ios' else 'android' end)
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
  -- Keep at most 10 phones per member.
  delete from public.push_tokens where user_id = auth.uid() and token not in (
    select token from public.push_tokens where user_id = auth.uid() order by updated_at desc limit 10);
end;
$$;

-- Called when someone logs out on the phone, so it stops getting their notifications.
create or replace function public.remove_push_token(p_token text)
returns void language sql security definer set search_path = public as $$
  delete from public.push_tokens where token = p_token
$$;

-- Used by the website to drop phones that Firebase says no longer exist.
create or replace function public.remove_dead_push_tokens(p_secret text, p_tokens text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_secret is null or p_secret <> (select decrypted_secret from vault.decrypted_secrets where name = 'push_secret') then
    raise exception 'Not allowed';
  end if;
  delete from public.push_tokens where token = any (p_tokens);
end;
$$;

-- Sends a notification to all of a member's phones (does nothing until the settings are saved).
create or replace function public.send_push(p_user uuid, p_title text, p_body text, p_url text, p_tag text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  push_url text;
  push_secret text;
  tokens jsonb;
begin
  select coalesce(jsonb_agg(token), '[]') into tokens from public.push_tokens where user_id = p_user;
  if jsonb_array_length(tokens) = 0 then
    return;
  end if;
  select decrypted_secret into push_url from vault.decrypted_secrets where name = 'push_url';
  select decrypted_secret into push_secret from vault.decrypted_secrets where name = 'push_secret';
  if push_url is null or push_secret is null then
    return;
  end if;
  perform net.http_post(
    url := push_url,
    body := jsonb_build_object('tokens', tokens, 'title', left(p_title, 100), 'body', left(p_body, 240), 'url', p_url, 'tag', p_tag),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', push_secret),
    timeout_milliseconds := 10000);
end;
$$;

-- New chat message: notify the other person's phones straight away.
create or replace function public.push_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.conversations;
  to_id uuid;
  sender_name text;
begin
  select * into c from public.conversations where id = new.conversation_id;
  if c.blocked_by is not null then
    return new;
  end if;
  to_id := case when new.sender_id = c.buyer_id then c.seller_id else c.buyer_id end;
  if not exists (select 1 from public.profiles where id = to_id and notify_chat and not is_banned) then
    return new;
  end if;
  select coalesce(nullif(case when business_until > now() then business_name end, ''), nullif(full_name, ''), 'New message')
    into sender_name from public.profiles where id = new.sender_id;
  perform public.send_push(to_id, sender_name, left(new.body, 200), '/messages/' || c.id, 'chat-' || c.id);
  return new;
exception when others then
  -- A notification problem must never stop the message being sent.
  return new;
end;
$$;

drop trigger if exists push_new_message on public.messages;
create trigger push_new_message after insert on public.messages
  for each row execute function public.push_new_message();

revoke execute on function public.send_push(uuid, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.save_push_token(text, text) from public, anon;
grant execute on function public.save_push_token(text, text) to authenticated;
grant execute on function public.remove_push_token(text) to anon, authenticated;
grant execute on function public.remove_dead_push_tokens(text, text[]) to anon, authenticated;


-- ========== 20261109000000_push_admin.sql ==========
-- Pacific Listing: let admins see a member's notification phones and send them a test.
create or replace function public.admin_push_tokens(p_user uuid)
returns table (token text, platform text, updated_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed';
  end if;
  return query select t.token, t.platform, t.updated_at from public.push_tokens t where t.user_id = p_user order by t.updated_at desc;
end;
$$;

revoke execute on function public.admin_push_tokens(uuid) from public, anon;
grant execute on function public.admin_push_tokens(uuid) to authenticated;


-- ========== 20261110000000_push_check.sql ==========
-- Pacific Listing: "Check notification setup" in the admin panel.
-- Shows whether each part of the chat-notification path is in place, and the database's
-- last calls to the website, so problems can be spotted without digging into Supabase.
create or replace function public.admin_push_check()
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed';
  end if;
  return json_build_object(
    'push_url', (select decrypted_secret from vault.decrypted_secrets where name = 'push_url'),
    'push_secret_saved', exists (select 1 from vault.decrypted_secrets where name = 'push_secret'),
    'chat_trigger', exists (select 1 from pg_trigger where tgname = 'push_new_message' and not tgisinternal),
    'phones', (select count(*) from public.push_tokens),
    'recent', (select coalesce(json_agg(r order by r.created desc), '[]') from (
      select status_code, left(coalesce(content, ''), 200) as content, error_msg, timed_out, created
      from net._http_response
      where content like '%"sent"%' or content like '%"error"%' or content like '%Not allowed%' or error_msg is not null
         or (status_code is not null and status_code not between 200 and 299)
      order by created desc limit 8) r)
  );
end;
$$;

revoke execute on function public.admin_push_check() from public, anon;
grant execute on function public.admin_push_check() to authenticated;


-- ========== 20261111000000_push_secret_fix.sql ==========
-- Pacific Listing: only accept the real push password (an unset password used to let any value through).
create or replace function public.remove_dead_push_tokens(p_secret text, p_tokens text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  saved text := (select decrypted_secret from vault.decrypted_secrets where name = 'push_secret');
begin
  if saved is null or p_secret is null or p_secret <> saved then
    raise exception 'Not allowed';
  end if;
  delete from public.push_tokens where token = any (p_tokens);
end;
$$;


-- ========== 20261112000000_edit_messages.sql ==========
-- Pacific Listing: edit your own chat messages for 15 minutes after sending.
alter table public.messages add column if not exists edited_at timestamptz;

create or replace function public.edit_message(p_id bigint, p_body text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.messages;
  c public.conversations;
  new_body text := btrim(coalesce(p_body, ''));
begin
  select * into m from public.messages where id = p_id;
  if m.id is null or m.sender_id is distinct from auth.uid() then
    raise exception 'You can only edit your own messages.';
  end if;
  if m.created_at < now() - interval '15 minutes' then
    raise exception 'Messages can only be edited for 15 minutes after sending.';
  end if;
  if char_length(new_body) not between 1 and 2000 then
    raise exception 'Write a message first.';
  end if;
  select * into c from public.conversations where id = m.conversation_id;
  if c.blocked_by is not null then
    raise exception 'This chat is blocked.';
  end if;
  if new_body = m.body then
    return json_build_object('id', m.id, 'body', m.body, 'edited_at', m.edited_at);
  end if;
  update public.messages set body = new_body, edited_at = now() where id = p_id returning * into m;
  -- Keep the inbox preview right if this was the latest message.
  update public.conversations set last_message = left(m.body, 200)
  where id = m.conversation_id and last_message_at = m.created_at and last_sender_id = m.sender_id;
  return json_build_object('id', m.id, 'body', m.body, 'edited_at', m.edited_at);
end;
$$;

revoke execute on function public.edit_message(bigint, text) from public, anon;
grant execute on function public.edit_message(bigint, text) to authenticated;


-- ========== 20261113000000_support_chats.sql ==========
-- Pacific Listing: staff can message any member. The chat appears in the member's
-- Messages as "Pacific Listing Support"; any staff member can read and reply to it
-- from Admin -> Member chats.

alter table public.conversations add column if not exists is_support boolean not null default false;
create unique index if not exists conversations_one_support_idx on public.conversations (buyer_id) where is_support;

-- Staff take part in every support chat (reading, sending, marking read).
create or replace function public.in_conversation(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversations
    where id = cid and (auth.uid() in (buyer_id, seller_id) or (is_support and public.is_staff()))
  )
$$;

create or replace function public.mark_chat_read(cid uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.conversations set
    buyer_read_at = case when buyer_id = auth.uid() then now() else buyer_read_at end,
    seller_read_at = case when seller_id = auth.uid() or (is_support and public.is_staff() and buyer_id <> auth.uid()) then now() else seller_read_at end
  where id = cid and (auth.uid() in (buyer_id, seller_id) or (is_support and public.is_staff()))
$$;

-- Support chats can't be blocked.
create or replace function public.set_chat_blocked(cid uuid, blocked boolean)
returns void
language sql
security definer
set search_path = public
as $$
  update public.conversations set
    blocked_by = case when blocked then coalesce(blocked_by, auth.uid()) when blocked_by = auth.uid() then null else blocked_by end
  where id = cid and auth.uid() in (buyer_id, seller_id) and not is_support
$$;

-- The name shown for a message's sender (staff appear as "Pacific Listing Support").
create or replace function public.chat_sender_name(cid uuid, sender uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when (select is_support and buyer_id <> sender from public.conversations where id = cid) then 'Pacific Listing Support'
    else (select coalesce(nullif(case when business_until > now() then business_name end, ''), nullif(full_name, ''), 'A member')
          from public.profiles where id = sender)
  end
$$;

-- Opens (or reopens) the support chat with a member and returns its id. Staff only.
create or replace function public.start_support_chat(p_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid;
begin
  if not public.is_staff() then
    raise exception 'Not allowed';
  end if;
  if p_user = auth.uid() then
    raise exception 'You can''t message yourself.';
  end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'Member not found.';
  end if;
  select id into cid from public.conversations where buyer_id = p_user and is_support;
  if cid is null then
    insert into public.conversations (listing_id, buyer_id, seller_id, listing_title, is_support)
    values (null, p_user, auth.uid(), 'Pacific Listing Support', true)
    returning id into cid;
  end if;
  update public.conversations set buyer_hidden = false where id = cid;
  return cid;
end;
$$;

-- Phone notifications: members see "Pacific Listing Support"; staff aren't buzzed for replies.
create or replace function public.push_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.conversations;
  to_id uuid;
begin
  select * into c from public.conversations where id = new.conversation_id;
  if c.blocked_by is not null then
    return new;
  end if;
  if c.is_support and new.sender_id = c.buyer_id then
    return new;
  end if;
  to_id := case when c.is_support then c.buyer_id when new.sender_id = c.buyer_id then c.seller_id else c.buyer_id end;
  if not exists (select 1 from public.profiles where id = to_id and notify_chat and not is_banned) then
    return new;
  end if;
  perform public.send_push(to_id, public.chat_sender_name(c.id, new.sender_id), left(new.body, 200), '/messages/' || c.id, 'chat-' || c.id);
  return new;
exception when others then
  return new;
end;
$$;

-- Email alerts for unread chats (support-aware).
create or replace function public.queue_chat_alerts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  n integer := 0;
  sender_name text;
begin
  for c in
    select conv.*, case when conv.last_sender_id = conv.buyer_id then conv.seller_id else conv.buyer_id end as to_id
    from public.conversations conv
    where conv.last_message_at between now() - interval '1 day' and now() - interval '5 minutes'
      and conv.blocked_by is null
      and conv.last_sender_id is not null
  loop
    -- Unread by the other person, and not already emailed since they last read it.
    if c.to_id = c.buyer_id then
      continue when c.last_message_at <= c.buyer_read_at or (c.buyer_alerted_at is not null and c.buyer_alerted_at > c.buyer_read_at);
    else
      continue when c.last_message_at <= c.seller_read_at or (c.seller_alerted_at is not null and c.seller_alerted_at > c.seller_read_at);
    end if;
    continue when not exists (select 1 from public.profiles where id = c.to_id and notify_chat and not is_banned);
    -- Staff see member replies in the admin panel instead of by email.
    continue when c.is_support and c.to_id <> c.buyer_id;

    sender_name := public.chat_sender_name(c.id, c.last_sender_id);

    perform public.queue_email(
      c.to_id, 'chat',
      case when c.is_support then 'New message from Pacific Listing Support'
           else 'New message from ' || sender_name || ' about "' || left(c.listing_title, 60) || '"' end,
      public.email_layout(
        'You have a new message',
        '<p style="margin:0 0 12px"><strong>' || public.esc(sender_name) || '</strong> sent you a message'
          || case when c.is_support then ':' else ' about <strong>' || public.esc(c.listing_title) || '</strong>:' end || '</p>'
          || '<p style="margin:0;padding:12px 14px;background:#f1f5f9;border-radius:10px">' || public.esc(left(c.last_message, 200)) || '</p>',
        'Reply now',
        public.site_url() || '/messages/' || c.id,
        public.unsubscribe_footer((select unsubscribe_token from public.profiles where id = c.to_id), 'chat',
          'someone messaged you on Pacific Listing')));

    if c.to_id = c.buyer_id then
      update public.conversations set buyer_alerted_at = now() where id = c.id;
    else
      update public.conversations set seller_alerted_at = now() where id = c.id;
    end if;
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Ratings (not for support chats).
create or replace function public.submit_review(p_conversation uuid, p_rating integer, p_comment text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  c public.conversations;
  other uuid;
begin
  if uid is null then
    raise exception 'Please log in.';
  end if;
  if (select is_banned from public.profiles where id = uid) then
    raise exception 'Your account is suspended.';
  end if;
  select * into c from public.conversations where id = p_conversation and uid in (buyer_id, seller_id);
  if c.id is null then
    raise exception 'Chat not found.';
  end if;
  if c.is_support then
    raise exception 'Support chats can''t be rated.';
  end if;
  other := case when uid = c.buyer_id then c.seller_id else c.buyer_id end;
  if not exists (select 1 from public.messages where conversation_id = c.id and sender_id = uid)
     or not exists (select 1 from public.messages where conversation_id = c.id and sender_id = other) then
    raise exception 'You can leave a rating once you''ve both sent messages in this chat.';
  end if;
  if p_rating not between 1 and 5 then
    raise exception 'Choose from 1 to 5 stars.';
  end if;
  insert into public.reviews (reviewer_id, reviewee_id, conversation_id, rating, comment)
  values (uid, other, c.id, p_rating, nullif(left(trim(p_comment), 1000), ''))
  on conflict (reviewer_id, reviewee_id) do update
    set rating = excluded.rating, comment = excluded.comment, conversation_id = excluded.conversation_id, updated_at = now();
end;
$$;

-- Admin -> Member chats.
create or replace function public.admin_support_chats()
returns table (id uuid, member_id uuid, member_name text, last_message text, last_message_at timestamptz, last_from_member boolean, unread boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Not allowed';
  end if;
  return query
    select c.id, c.buyer_id, coalesce(nullif(p.full_name, ''), 'Member'), c.last_message, coalesce(c.last_message_at, c.created_at),
           c.last_sender_id = c.buyer_id, (c.last_sender_id = c.buyer_id and c.last_message_at > c.seller_read_at)
    from public.conversations c join public.profiles p on p.id = c.buyer_id
    where c.is_support
    order by coalesce(c.last_message_at, c.created_at) desc
    limit 200;
end;
$$;

revoke execute on function public.start_support_chat(uuid) from public, anon;
revoke execute on function public.admin_support_chats() from public, anon;
grant execute on function public.start_support_chat(uuid) to authenticated;
grant execute on function public.admin_support_chats() to authenticated;


-- ========== 20261114000000_support_inbox.sql ==========
-- Pacific Listing: support chats a staff member started don't count towards that staff
-- member's own Chats badge (they're in Admin -> Member chats, with their own badge).
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
      or (seller_id = auth.uid() and not is_support and not seller_hidden and last_message_at > seller_read_at))
$$;


-- ========== 20261115000000_faster_chat_emails.sql ==========
-- Pacific Listing: faster chat emails. The app now buzzes instantly, so the email is a backup:
-- sent when a message is still unread after 2 minutes (was 5), checked every minute (was 2).
create or replace function public.queue_chat_alerts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  n integer := 0;
  sender_name text;
begin
  for c in
    select conv.*, case when conv.last_sender_id = conv.buyer_id then conv.seller_id else conv.buyer_id end as to_id
    from public.conversations conv
    where conv.last_message_at between now() - interval '1 day' and now() - interval '2 minutes'
      and conv.blocked_by is null
      and conv.last_sender_id is not null
  loop
    -- Unread by the other person, and not already emailed since they last read it.
    if c.to_id = c.buyer_id then
      continue when c.last_message_at <= c.buyer_read_at or (c.buyer_alerted_at is not null and c.buyer_alerted_at > c.buyer_read_at);
    else
      continue when c.last_message_at <= c.seller_read_at or (c.seller_alerted_at is not null and c.seller_alerted_at > c.seller_read_at);
    end if;
    continue when not exists (select 1 from public.profiles where id = c.to_id and notify_chat and not is_banned);
    -- Staff see member replies in the admin panel instead of by email.
    continue when c.is_support and c.to_id <> c.buyer_id;

    sender_name := public.chat_sender_name(c.id, c.last_sender_id);

    perform public.queue_email(
      c.to_id, 'chat',
      case when c.is_support then 'New message from Pacific Listing Support'
           else 'New message from ' || sender_name || ' about "' || left(c.listing_title, 60) || '"' end,
      public.email_layout(
        'You have a new message',
        '<p style="margin:0 0 12px"><strong>' || public.esc(sender_name) || '</strong> sent you a message'
          || case when c.is_support then ':' else ' about <strong>' || public.esc(c.listing_title) || '</strong>:' end || '</p>'
          || '<p style="margin:0;padding:12px 14px;background:#f1f5f9;border-radius:10px">' || public.esc(left(c.last_message, 200)) || '</p>',
        'Reply now',
        public.site_url() || '/messages/' || c.id,
        public.unsubscribe_footer((select unsubscribe_token from public.profiles where id = c.to_id), 'chat',
          'someone messaged you on Pacific Listing')));

    if c.to_id = c.buyer_id then
      update public.conversations set buyer_alerted_at = now() where id = c.id;
    else
      update public.conversations set seller_alerted_at = now() where id = c.id;
    end if;
    n := n + 1;
  end loop;
  return n;
end;
$$;

do $$
begin
  perform cron.unschedule('email-alerts');
exception when others then null;
end;
$$;
select cron.schedule('email-alerts', '* * * * *', $$select public.queue_chat_alerts(); select public.flush_email_outbox();$$);
