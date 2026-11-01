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
