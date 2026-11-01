-- Pacific Listing: banner spots can show "Price on request" instead of weekly prices.
alter table public.ad_slots add column if not exists show_price boolean not null default true;
