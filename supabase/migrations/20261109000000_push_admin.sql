-- Pacific Listing: let admins see a member's notification phones and send them a test.
create or replace function public.admin_push_tokens(p_user uuid)
returns table (token text, platform text, updated_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed';
  end if;
  return query select t.token, t.platform, t.updated_at from public.push_tokens t where t.user_id = p_user order by t.updated_at desc;
end;
$$;

revoke execute on function public.admin_push_tokens(uuid) from public, anon;
grant execute on function public.admin_push_tokens(uuid) to authenticated;
