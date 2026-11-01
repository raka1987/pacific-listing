-- Pacific Listing: "Check notification setup" in the admin panel.
-- Shows whether each part of the chat-notification path is in place, and the database's
-- last calls to the website, so problems can be spotted without digging into Supabase.
create or replace function public.admin_push_check()
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed';
  end if;
  return json_build_object(
    'push_url', (select decrypted_secret from vault.decrypted_secrets where name = 'push_url'),
    'push_secret_saved', exists (select 1 from vault.decrypted_secrets where name = 'push_secret'),
    'chat_trigger', exists (select 1 from pg_trigger where tgname = 'push_new_message' and not tgisinternal),
    'phones', (select count(*) from public.push_tokens),
    'recent', (select coalesce(json_agg(r order by r.created desc), '[]') from (
      select status_code, left(coalesce(content, ''), 200) as content, error_msg, timed_out, created
      from net._http_response
      where content like '%"sent"%' or content like '%"error"%' or content like '%Not allowed%' or error_msg is not null
         or (status_code is not null and status_code not between 200 and 299)
      order by created desc limit 8) r)
  );
end;
$$;

revoke execute on function public.admin_push_check() from public, anon;
grant execute on function public.admin_push_check() to authenticated;
