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
