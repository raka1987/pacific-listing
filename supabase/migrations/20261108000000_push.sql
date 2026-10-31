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
