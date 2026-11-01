-- Pacific Listing: private phone numbers.
-- Sellers can keep their number private: buyers see part of it (+679 92•• •••) and ask for it
-- in the chat; the seller shares it with that one buyer. Full numbers are never sent to anyone
-- else's phone or browser. Existing ads stay public; new ads are private unless the seller unticks it.
--
-- NOTE for future changes: reading listings is now granted column by column. A new column on
-- public.listings must also be granted: grant select (new_column) on public.listings to anon, authenticated;

alter table public.listings add column if not exists phone_private boolean not null default false;
alter table public.conversations add column if not exists number_shared_at timestamptz;

-- ---------------------------------------------------------------------------
-- Lock the numbers: nobody reads them directly any more.
-- ---------------------------------------------------------------------------
revoke select on public.listings from anon, authenticated;
do $$
declare
  cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'listings' and column_name not in ('contact_phone', 'contact_whatsapp');
  execute format('grant select (%s) on public.listings to anon, authenticated', cols);
end;
$$;
revoke select (phone, whatsapp) on public.profiles from anon, authenticated;

-- ---------------------------------------------------------------------------
-- "+679 9234 567" -> "+679 92•• •••" (keeps the first digits, hides the last five or more).
-- ---------------------------------------------------------------------------
create or replace function public.mask_phone(p text)
returns text
language plpgsql
immutable
as $$
declare
  result text := '';
  ch text;
  n integer := 0;
  total integer;
begin
  if p is null or btrim(p) = '' then
    return null;
  end if;
  total := length(regexp_replace(p, '\D', '', 'g'));
  foreach ch in array regexp_split_to_array(p, '') loop
    if ch ~ '\d' then
      n := n + 1;
      result := result || case when n <= greatest(total - 5, 3) then ch else '•' end;
    else
      result := result || ch;
    end if;
  end loop;
  return result;
end;
$$;

-- What a viewer may see of an ad's phone and WhatsApp numbers.
create or replace function public.get_listing_contact(p_listing uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  l public.listings;
  phone text;
  wa text;
  shared boolean;
  visible boolean;
begin
  select * into l from public.listings where id = p_listing;
  if l.id is null then
    return null;
  end if;
  if l.status not in ('active', 'sold') and l.user_id is distinct from auth.uid() and not public.is_staff() then
    return null;
  end if;
  select coalesce(nullif(btrim(l.contact_phone), ''), nullif(btrim(p.phone), '')),
         coalesce(nullif(btrim(l.contact_whatsapp), ''), nullif(btrim(p.whatsapp), ''))
    into phone, wa
    from public.profiles p where p.id = l.user_id;
  shared := auth.uid() is not null and exists (
    select 1 from public.conversations c
    where c.listing_id = l.id and c.buyer_id = auth.uid() and c.number_shared_at is not null);
  visible := not l.phone_private or auth.uid() = l.user_id or public.is_staff() or shared;
  return json_build_object(
    'private', l.phone_private,
    'visible', visible,
    'shared', shared,
    'phone', case when visible then phone end,
    'whatsapp', case when visible then wa end,
    'masked_phone', public.mask_phone(phone),
    'masked_whatsapp', public.mask_phone(wa));
end;
$$;

-- The seller's own numbers, for editing an ad.
create or replace function public.my_listing_contact(p_listing uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object('contact_phone', contact_phone, 'contact_whatsapp', contact_whatsapp, 'phone_private', phone_private)
  from public.listings where id = p_listing and (user_id = auth.uid() or public.is_staff())
$$;

-- The member's own profile numbers.
create or replace function public.my_contact()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object('phone', phone, 'whatsapp', whatsapp) from public.profiles where id = auth.uid()
$$;

-- In a chat, the seller shares their number with that buyer (and says so in the chat).
create or replace function public.share_my_number(cid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.conversations;
begin
  select * into c from public.conversations where id = cid;
  if c.id is null or c.seller_id is distinct from auth.uid() or c.is_support then
    raise exception 'Only the seller can share their number in this chat.';
  end if;
  if c.blocked_by is not null then
    raise exception 'This chat is blocked.';
  end if;
  if c.number_shared_at is null then
    update public.conversations set number_shared_at = now() where id = cid;
    insert into public.messages (conversation_id, sender_id, body)
    values (cid, auth.uid(), '📞 I''ve shared my phone number with you. You''ll find it at the top of this chat.');
  end if;
end;
$$;

revoke execute on function public.my_listing_contact(uuid) from public, anon;
revoke execute on function public.my_contact() from public, anon;
revoke execute on function public.share_my_number(uuid) from public, anon;
grant execute on function public.get_listing_contact(uuid) to anon, authenticated;
grant execute on function public.my_listing_contact(uuid) to authenticated;
grant execute on function public.my_contact() to authenticated;
grant execute on function public.share_my_number(uuid) to authenticated;
