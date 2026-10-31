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
