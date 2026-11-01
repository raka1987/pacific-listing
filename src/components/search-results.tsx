import { getAuthUser } from "@/lib/auth";
import Link from "next/link";
import { MapPin, SearchX, X } from "lucide-react";
import { categoryBySlug, countryByCode, subcategoryBySlug } from "@/lib/constants";
import { getFavoriteIds, searchListings, type SearchFilters } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { AdBanner } from "./ad-banner";
import { CategoryChips, SubcategoryChips } from "./category-chips";
import { EmptyState } from "./empty-state";
import { ListingGrid } from "./listing-card";
import { Pagination } from "./pagination";
import { SearchBar } from "./search-bar";
import { SearchFiltersPanel, SortSelect } from "./search-filters";
import { Suspense } from "react";
import { searchRow } from "@/app/alerts-actions";
import { searchHref } from "@/lib/saved-search";
import { TOWNS } from "@/lib/places";
import { DISTANCES, findPlace, placesNear } from "@/lib/town-coords";
import { SaveSearchButton } from "./save-search-button";

export async function SearchResults({
  filters,
  basePath,
  title,
  lockCategory,
  pagePath,
  landingCountry,
  intro,
  children,
}: {
  filters: SearchFilters;
  /** Where filter changes go */
  basePath: string;
  title: string;
  lockCategory?: boolean;
  /** Where page-number links go, if different (landing pages) */
  pagePath?: string;
  /** On country landing pages, category buttons link to that country's pages */
  landingCountry?: string;
  intro?: React.ReactNode;
  /** Extra content under the results, e.g. FAQs */
  children?: React.ReactNode;
}) {
  const supabase = await createClient();
  const user = await getAuthUser();
  // Towns to narrow a country down by (not on country landing pages, which have their own town pages).
  const townCountry = !landingCountry && filters.country ? filters.country : null;
  const [{ listings, total, page, totalPages }, favoriteIds, towns] = await Promise.all([
    searchListings(supabase, filters),
    getFavoriteIds(supabase, user?.id),
    townCountry ? townsWithAds(supabase, townCountry) : Promise.resolve([]),
  ]);

  // Is this exact search already saved?
  const row = await searchRow(filters);
  let saved = false;
  if (user) {
    let q = supabase.from("saved_searches").select("id", { count: "exact", head: true }).eq("user_id", user.id);
    for (const [k, v] of Object.entries(row)) q = v == null ? q.is(k, null) : q.eq(k, v);
    saved = ((await q).count ?? 0) > 0;
  }

  const qs = (overrides: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { ...filters, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v && !(lockCategory && k === "category")) p.set(k, v);
    return `${basePath}${p.size ? `?${p}` : ""}`;
  };

  const chips: { label: string; remove: Record<string, undefined> }[] = [];
  if (filters.q) chips.push({ label: `“${filters.q}”`, remove: { q: undefined } });
  if (filters.category && !lockCategory)
    chips.push({ label: categoryBySlug(filters.category)?.name ?? filters.category, remove: { category: undefined, sub: undefined } });
  const sub = subcategoryBySlug(filters.category, filters.sub);
  if (sub) chips.push({ label: sub.name, remove: { sub: undefined } });
  if (filters.country) chips.push({ label: countryByCode(filters.country)?.name ?? filters.country, remove: { country: undefined } });
  const place = findPlace(filters.country, filters.city);
  const radius = place && (DISTANCES as readonly number[]).includes(Number(filters.km)) ? Number(filters.km) : 0;
  if (filters.city) chips.push({ label: radius ? `${filters.city} + ${radius} km` : filters.city, remove: { city: undefined, km: undefined } });
  const nearby = radius ? (placesNear(filters.country, filters.city, radius) ?? []).slice(1) : [];
  if (filters.min || filters.max)
    chips.push({ label: `Price ${filters.min || "0"} – ${filters.max || "any"}`, remove: { min: undefined, max: undefined } });
  if (filters.condition) chips.push({ label: filters.condition === "new" ? "New" : "Used", remove: { condition: undefined } });

  return (
    <div className="container-page py-5 sm:py-8">
      <div className="mb-4 md:hidden">
        <Suspense>
          <SearchBar />
        </Suspense>
      </div>
      <CategoryChips active={filters.category} q={filters.q} country={filters.country} landingCountry={landingCountry} />
      {filters.category && (
        <SubcategoryChips category={filters.category} active={filters.sub} q={filters.q} country={filters.country} landingCountry={landingCountry} />
      )}
      {towns.length > 0 && (
        <nav aria-label="Towns" className="scrollbar-none -mx-4 -mt-3 mb-6 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          <MapPin className="h-4 w-4 shrink-0 text-muted" />
          {[{ name: "", label: `All of ${countryByCode(townCountry)?.name ?? ""}` }, ...towns.map((t) => ({ name: t, label: t }))].map((t) => {
            const on = (filters.city ?? "").toLowerCase() === t.name.toLowerCase();
            return (
              <Link
                key={t.label}
                href={qs({ city: t.name || undefined, km: t.name ? filters.km : undefined, page: undefined })}
                aria-current={on ? "page" : undefined}
                className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-sm transition ${
                  on ? "border-lagoon-600 bg-lagoon-600 text-white" : "border-line bg-surface text-ink-2 hover:border-faint hover:text-ink"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      )}
      {place && (
        <div className="-mt-3 mb-6">
          <nav aria-label="Distance" className="scrollbar-none -mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            <span className="shrink-0 text-sm text-muted">Distance:</span>
            {[{ v: 0, label: `Just ${place.name}` }, ...DISTANCES.map((d) => ({ v: d, label: `+ ${d} km` }))].map((d) => (
              <Link
                key={d.v}
                href={qs({ km: d.v ? String(d.v) : undefined, page: undefined })}
                aria-current={radius === d.v ? "page" : undefined}
                className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-sm transition ${
                  radius === d.v ? "border-lagoon-600 bg-lagoon-600 text-white" : "border-line bg-surface text-ink-2 hover:border-faint hover:text-ink"
                }`}
              >
                {d.label}
              </Link>
            ))}
          </nav>
          {nearby.length > 0 && <p className="mt-2 text-xs text-muted">Also showing ads from {nearby.join(", ")}.</p>}
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <SearchFiltersPanel filters={filters} basePath={basePath} lockCategory={lockCategory} />
        <div className="min-w-0">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-semibold text-ink sm:text-3xl">{title}</h1>
              <p className="text-sm text-muted">
                {total.toLocaleString()} {total === 1 ? "result" : "results"}
              </p>
              {intro && <div className="mt-2 max-w-2xl text-sm text-ink-2">{intro}</div>}
            </div>
            <div className="flex items-center gap-2">
              <SaveSearchButton filters={filters} back={searchHref(row)} saved={saved} />
              <SortSelect value={filters.sort} />
            </div>
          </div>
          <div className="mb-6">
            <AdBanner slot="category_top" category={filters.category} compact />
          </div>
          {chips.length > 0 && (
            <div className="mb-5 flex flex-wrap gap-2">
              {chips.map((c) => (
                <Link
                  key={c.label}
                  href={qs({ ...c.remove, page: undefined })}
                  className="chip border-lagoon-200 bg-lagoon-50 py-1.5 pr-2.5 text-lagoon-800"
                >
                  {c.label} <X className="h-3.5 w-3.5" />
                </Link>
              ))}
            </div>
          )}
          {listings.length ? (
            <>
              <ListingGrid listings={listings} favoriteIds={favoriteIds} />
              <Pagination page={page} totalPages={totalPages} makeHref={(p) => (pagePath ? `${pagePath}${p > 1 ? `?page=${p}` : ""}` : qs({ page: p > 1 ? String(p) : undefined }))} />
            </>
          ) : (
            landingCountry ? (
              <EmptyState
                icon={SearchX}
                title="Nothing here yet"
                description="Be the first to list here. It's free, takes a minute, and local buyers will find your ad."
                action={
                  <Link href="/post" className="btn-accent">
                    List an item free
                  </Link>
                }
              />
            ) : (
              <EmptyState
                icon={SearchX}
                title="No listings found"
                description="Try fewer filters or a different search. New ads are posted every day."
                action={
                  <Link href={basePath} className="btn-secondary">
                    Clear filters
                  </Link>
                }
              />
            )
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

/** The main towns in a country plus any others people have listed ads in, busiest first. */
async function townsWithAds(supabase: Awaited<ReturnType<typeof createClient>>, country: string) {
  const { data } = await supabase.from("listings").select("city").eq("status", "active").eq("country", country).not("city", "is", null).limit(2000);
  const counts = new Map<string, { name: string; n: number }>();
  for (const t of TOWNS[country] ?? []) counts.set(t.toLowerCase(), { name: t, n: 0 });
  for (const r of (data ?? []) as { city: string }[]) {
    const name = r.city.trim().replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 30) continue;
    const key = name.toLowerCase();
    const c = counts.get(key) ?? { name, n: 0 };
    c.n++;
    counts.set(key, c);
  }
  const main = new Set((TOWNS[country] ?? []).map((t) => t.toLowerCase()));
  return [...counts.entries()]
    // Main towns always show; other places once two or more ads mention them.
    .filter(([k, c]) => main.has(k) || c.n >= 2)
    .sort((a, b) => b[1].n - a[1].n)
    .slice(0, 14)
    .map(([, c]) => c.name);
}
