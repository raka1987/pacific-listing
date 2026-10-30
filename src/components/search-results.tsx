import { getAuthUser } from "@/lib/auth";
import Link from "next/link";
import { SearchX, X } from "lucide-react";
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

export async function SearchResults({
  filters,
  basePath,
  title,
  lockCategory,
}: {
  filters: SearchFilters;
  basePath: string;
  title: string;
  lockCategory?: boolean;
}) {
  const supabase = await createClient();
  const user = await getAuthUser();
  const [{ listings, total, page, totalPages }, favoriteIds] = await Promise.all([
    searchListings(supabase, filters),
    getFavoriteIds(supabase, user?.id),
  ]);

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
  if (filters.city) chips.push({ label: filters.city, remove: { city: undefined } });
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
      <CategoryChips active={filters.category} q={filters.q} country={filters.country} />
      {filters.category && <SubcategoryChips category={filters.category} active={filters.sub} q={filters.q} country={filters.country} />}
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <SearchFiltersPanel filters={filters} basePath={basePath} lockCategory={lockCategory} />
        <div className="min-w-0">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-semibold text-ink sm:text-3xl">{title}</h1>
              <p className="text-sm text-muted">
                {total.toLocaleString()} {total === 1 ? "result" : "results"}
              </p>
            </div>
            <div className="flex items-center gap-2">
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
              <Pagination page={page} totalPages={totalPages} makeHref={(p) => qs({ page: p > 1 ? String(p) : undefined })} />
            </>
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
          )}
        </div>
      </div>
    </div>
  );
}
