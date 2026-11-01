-- Pacific Listing: only accept the real push password (an unset password used to let any value through).
create or replace function public.remove_dead_push_tokens(p_secret text, p_tokens text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  saved text := (select decrypted_secret from vault.decrypted_secrets where name = 'push_secret');
begin
  if saved is null or p_secret is null or p_secret <> saved then
    raise exception 'Not allowed';
  end if;
  delete from public.push_tokens where token = any (p_tokens);
end;
$$;
