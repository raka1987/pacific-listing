-- Pacific Listing: location-aware advertising and currencies

-- Banner spots get a second, higher price for campaigns shown in every country.
alter table public.ad_slots add column global_prices jsonb not null default '{}';
update public.ad_slots set global_prices = public.example_prices((prices ->> 'FJD')::numeric * 3);

-- Country-targeted banners only show to visitors in those countries.
-- Global banners (no countries) show everywhere, including when the
-- visitor's country is unknown.
create or replace function public.get_ad(p_slot text, p_country text default null, p_category text default null)
returns table (id uuid, title text, image_url text, link_url text, advertiser_name text)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.title, c.image_url, c.link_url, c.advertiser_name
  from public.ad_campaigns c
  where c.slot_code = p_slot and c.status = 'active'
    and current_date between c.starts_on and c.ends_on
    and (cardinality(c.countries) = 0 or (p_country is not null and p_country = any (c.countries)))
    and (cardinality(c.categories) = 0 or p_category is null or p_category = any (c.categories))
  order by random()
  limit 1
$$;

-- Business plans can be paid in the currency the visitor chose, when the plan
-- has a price in it; otherwise the currency of the member's own country.
drop function public.create_subscription_order(uuid, text, text);
create or replace function public.create_subscription_order(p_plan uuid, p_method text, p_business_name text, p_currency text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  pl public.plans;
  cur text;
  amt numeric;
  oid uuid;
begin
  if auth.uid() is null then raise exception 'Please log in.'; end if;
  select * into pl from public.plans where id = p_plan and is_active;
  if pl.id is null then raise exception 'That plan is not available.'; end if;
  if coalesce(trim(p_business_name), '') = '' then raise exception 'Enter your business name.'; end if;
  if p_method not in ('mpaisa', 'mycash', 'bank', 'card') then raise exception 'Choose a payment method.'; end if;
  cur := case when p_currency is not null and pl.prices ? p_currency then p_currency
              else public.currency_for(coalesce((select country from public.profiles where id = auth.uid()), 'FJ')) end;
  amt := (pl.prices ->> cur)::numeric;
  if amt is null then raise exception 'That plan is not available in your currency yet.'; end if;
  insert into public.orders (user_id, kind, description, plan_id, amount, currency, method, billing_name, billing_email)
  values (auth.uid(), 'subscription', pl.name || ' · ' || pl.duration_days || ' days', pl.id, amt, cur, p_method,
          trim(p_business_name), (select email from public.profiles where id = auth.uid()))
  returning id into oid;
  return oid;
end;
$$;
