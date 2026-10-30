-- Pacific Listing: types within categories (e.g. Property > For rent, Vehicles > SUVs & 4x4)
alter table public.listings add column if not exists subcategory text;
create index if not exists listings_category_sub_idx on public.listings (category, subcategory);
