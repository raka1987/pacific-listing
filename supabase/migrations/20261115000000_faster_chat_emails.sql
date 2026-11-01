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
