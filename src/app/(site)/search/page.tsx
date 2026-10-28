import type { Metadata } from "next";
import { SearchResults } from "@/components/search-results";
import { categoryBySlug, countryByCode } from "@/lib/constants";
import type { SearchFilters } from "@/lib/queries";

type Props = { searchParams: Promise<SearchFilters> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const f = await searchParams;
  const parts = [f.q, categoryBySlug(f.category)?.name, countryByCode(f.country)?.name].filter(Boolean);
  return { title: parts.length ? `${parts.join(" · ")} — Search` : "Browse all listings", alternates: { canonical: "/search" } };
}

export default async function SearchPage({ searchParams }: Props) {
  const filters = await searchParams;
  const country = countryByCode(filters.country);
  const title = filters.q
    ? `Results for “${filters.q}”`
    : filters.category
      ? (categoryBySlug(filters.category)?.name ?? "All listings")
      : country
        ? `Listings in ${country.name}`
        : "All listings";
  return <SearchResults filters={filters} basePath="/search" title={title} />;
}
