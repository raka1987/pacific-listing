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
