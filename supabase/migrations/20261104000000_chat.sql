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
