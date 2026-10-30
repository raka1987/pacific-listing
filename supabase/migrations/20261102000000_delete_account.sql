-- Pacific Listing: let people delete their own account (required by the app stores).
-- Removes the login, profile, ads and saved ads. Payment records are kept for
-- the business's accounts but no longer linked to the person.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Please log in.';
  end if;
  if (select role from public.profiles where id = uid) = 'admin'
     and (select count(*) from public.profiles where role = 'admin' and not is_banned) <= 1 then
    raise exception 'You are the only admin. Make someone else an admin before deleting your account.';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
