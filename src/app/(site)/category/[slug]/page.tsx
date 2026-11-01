import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SearchResults } from "@/components/search-results";
import { categoryBySlug, countryByCode, subcategoryBySlug } from "@/lib/constants";
import { landingSubject } from "@/lib/landing";
import { withPickedCountry } from "@/lib/location";
import type { SearchFilters } from "@/lib/queries";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<SearchFilters> };

// Rendered per request so switching type (?sub=...) updates in place.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = categoryBySlug(slug);
  if (!category) return {};
  const sub = subcategoryBySlug(slug, (await searchParams).sub);
  return {
    title: sub ? `${sub.name} · ${category.name}` : landingSubject({ category }),
    description: `Browse ${category.name.toLowerCase()} listings across Fiji, Samoa, Tonga, Vanuatu and the Pacific on Pacific Listing.`,
    alternates: { canonical: `/category/${slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const category = categoryBySlug(slug);
  if (!category) notFound();
  const filters = { ...(await withPickedCountry(await searchParams)), category: slug };
  const country = countryByCode(filters.country);
  const sub = subcategoryBySlug(slug, filters.sub);
  const name = sub ? (slug === "property" ? `Property ${sub.name.toLowerCase()}` : sub.name) : category.name;
  return (
    <SearchResults
      filters={filters}
      basePath={`/category/${slug}`}
      title={country ? `${name} in ${country.name}` : name}
      lockCategory
      intro={
        slug === "tours" ? (
          <>
            Day trips, island hopping, diving, village visits and more, from local operators.{" "}
            <span className="text-muted">Run a tour or attraction?</span>{" "}
            <Link href="/post?category=tours" className="font-semibold text-lagoon-700 hover:underline">
              List it free
            </Link>
          </>
        ) : undefined
      }
    />
  );
}
