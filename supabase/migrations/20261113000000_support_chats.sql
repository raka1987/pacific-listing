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
