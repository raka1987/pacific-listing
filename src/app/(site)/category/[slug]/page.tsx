import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SearchResults } from "@/components/search-results";
import { CATEGORIES, categoryBySlug, countryByCode } from "@/lib/constants";
import type { SearchFilters } from "@/lib/queries";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<SearchFilters> };

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = categoryBySlug(slug);
  if (!category) return {};
  return {
    title: `${category.name} for sale`,
    description: `Browse ${category.name.toLowerCase()} listings across Fiji, Samoa, Tonga, Vanuatu and the Pacific on Pacific Listing.`,
    alternates: { canonical: `/category/${slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const category = categoryBySlug(slug);
  if (!category) notFound();
  const filters = { ...(await searchParams), category: slug };
  const country = countryByCode(filters.country);
  return (
    <SearchResults
      filters={filters}
      basePath={`/category/${slug}`}
      title={country ? `${category.name} in ${country.name}` : category.name}
      lockCategory
    />
  );
}
