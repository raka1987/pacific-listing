-- Pacific Listing: website traffic for the admin panel (visitors, page views, where they come from).
-- No cookies and no personal data: each visitor is a one-way code that changes every day.

create table if not exists public.page_views (
  id bigint generated always as identity primary key,
  path text not null,
  visitor text not null,
  country text,
  referrer text,
  device text not null default 'phone' check (device in ('phone', 'computer', 'app')),
  created_at timestamptz not null default now()
);
create index if not exists page_views_created_idx on public.page_views (created_at desc);

alter table public.page_views enable row level security;
-- Nobody reads or writes the table directly; the functions below do it.
revoke all on public.page_views from anon, authenticated;

-- Called by the website for each page someone opens.
create or replace function public.track_view(p_path text, p_visitor text, p_country text, p_referrer text, p_device text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.page_views (path, visitor, country, referrer, device)
  select left(p_path, 200), left(p_visitor, 64), upper(left(p_country, 2)), nullif(left(lower(p_referrer), 100), ''),
         case when p_device in ('phone', 'computer', 'app') then p_device else 'phone' end
  where p_path like '/%' and length(p_visitor) between 8 and 64
$$;

-- Everything the Traffic page shows, for the last p_days days (days counted in Fiji time).
create or replace function public.admin_traffic(p_days integer default 30)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  tz constant text := 'Pacific/Fiji';
  today date := (now() at time zone tz)::date;
  n_days integer := greatest(1, least(p_days, 365));
  since timestamptz := ((today - (n_days - 1))::timestamp at time zone tz);
begin
  if not public.is_staff() then
    raise exception 'Not allowed';
  end if;
  return json_build_object(
    'today', (select json_build_object('views', count(*), 'visitors', count(distinct visitor))
              from page_views where created_at >= (today::timestamp at time zone tz)),
    'period', (select json_build_object('views', count(*), 'visitors', count(distinct visitor || (created_at at time zone tz)::date))
               from page_views where created_at >= since),
    'by_day', (select coalesce(json_agg(json_build_object('day', d, 'views', coalesce(v.views, 0), 'visitors', coalesce(v.visitors, 0)) order by d), '[]')
               from generate_series(0, n_days - 1) i
               cross join lateral (select today - (n_days - 1) + i as d) dd
               left join (select (created_at at time zone tz)::date as vday, count(*) as views, count(distinct visitor) as visitors
                          from page_views where created_at >= since group by 1) v on v.vday = dd.d),
    'pages', (select coalesce(json_agg(t), '[]') from (
                select path, count(*) views, count(distinct visitor) visitors from page_views
                where created_at >= since group by path order by 2 desc limit 15) t),
    'countries', (select coalesce(json_agg(t), '[]') from (
                select coalesce(country, '??') country, count(distinct visitor) visitors from page_views
                where created_at >= since group by 1 order by 2 desc limit 12) t),
    'referrers', (select coalesce(json_agg(t), '[]') from (
                select referrer, count(distinct visitor) visitors from page_views
                where created_at >= since and referrer is not null group by 1 order by 2 desc limit 12) t),
    'devices', (select coalesce(json_object_agg(device, n), '{}') from (
                select device, count(distinct visitor) n from page_views where created_at >= since group by 1) t)
  );
end;
$$;

revoke execute on function public.admin_traffic(integer) from public, anon;
grant execute on function public.admin_traffic(integer) to authenticated;
grant execute on function public.track_view(text, text, text, text, text) to anon, authenticated;

-- Keep 13 months of history.
do $$
begin
  perform cron.unschedule('trim-page-views');
exception when others then null;
end;
$$;
select cron.schedule('trim-page-views', '17 3 * * *', $$delete from public.page_views where created_at < now() - interval '400 days'$$);
