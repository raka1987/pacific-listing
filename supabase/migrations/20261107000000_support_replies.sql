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
