import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SearchResults } from "@/components/search-results";
import { categoryBySlug, COUNTRIES, SITE, subcategoryBySlug } from "@/lib/constants";
import { landingDescription, landingSubject, landingTitle, resolveLanding, type Landing } from "@/lib/landing";
import { landingPath, slugify, TOWNS } from "@/lib/places";
import type { SearchFilters } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

// Search landing pages: /fiji, /fiji/vehicles, /fiji/vehicles/utes, /fiji/suva.

type Props = { params: Promise<{ country: string; path?: string[] }>; searchParams: Promise<SearchFilters> };

export const dynamic = "force-dynamic";

function filtersFor(l: Landing, extra: SearchFilters = {}): SearchFilters {
  return {
    q: extra.q,
    min: extra.min,
    max: extra.max,
    condition: extra.condition,
    sort: extra.sort,
    page: extra.page,
    country: l.country.code,
    category: l.category?.slug,
    sub: l.sub?.slug,
    city: l.town,
  };
}

async function countFor(l: Landing) {
  const supabase = await createClient();
  let q = supabase.from("listings").select("id", { count: "exact", head: true }).eq("status", "active").eq("country", l.country.code);
  if (l.category) q = q.eq("category", l.category.slug);
  if (l.sub) q = q.eq("subcategory", l.sub.slug);
  if (l.town) q = q.ilike("city", `%${l.town}%`);
  const { count } = await q;
  return count ?? 0;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { country, path } = await params;
  const l = resolveLanding(country, path);
  if (!l) return {};
  const count = await countFor(l);
  const self = landingPath(l.country.code, l.category?.slug, l.sub?.slug, l.town ? slugify(l.town) : undefined);
  const title = landingTitle(l);
  const description = landingDescription(l, count);
  return {
    title,
    description,
    alternates: { canonical: self },
    // Empty pages deeper than the country page aren't worth showing in search results yet.
    robots: count === 0 && (l.category || l.town) ? { index: false, follow: true } : undefined,
    openGraph: { title: `${title} | ${SITE.name}`, description, url: self },
  };
}

export default async function LandingPage({ params, searchParams }: Props) {
  const { country, path } = await params;
  const l = resolveLanding(country, path);
  if (!l) notFound();
  const sp = await searchParams;
  const filters = filtersFor(l, sp);
  const self = landingPath(l.country.code, l.category?.slug, l.sub?.slug, l.town ? slugify(l.town) : undefined);
  const title = landingTitle(l);
  const subject = landingSubject(l).toLowerCase();
  const towns = TOWNS[l.country.code] ?? [];

  // Search-friendly details: breadcrumbs and FAQs.
  const crumbs = [
    { name: "Pacific Listing", url: SITE.url },
    { name: l.country.name, url: `${SITE.url}${landingPath(l.country.code)}` },
    ...(l.category ? [{ name: l.category.name, url: `${SITE.url}${landingPath(l.country.code, l.category.slug)}` }] : []),
    ...(l.sub ? [{ name: l.sub.name, url: `${SITE.url}${self}` }] : []),
    ...(l.town ? [{ name: l.town, url: `${SITE.url}${self}` }] : []),
  ];
  const where = l.town ? `${l.town}, ${l.country.name}` : l.country.name;
  const faqs = [
    {
      q: `How do I find ${subject} in ${where}?`,
      a: `Browse the latest ads on this page, or use the filters to narrow down by price, town and condition. Tap an ad to see photos and contact the seller directly by phone or WhatsApp.`,
    },
    {
      q: `How do I sell on Pacific Listing in ${l.country.name}?`,
      a: `Tap "List", add a few photos, a price and your town, and your ad goes live. Posting is free, and buyers contact you directly. Prices show in ${l.country.currency}.`,
    },
    {
      q: "How do I buy and sell safely?",
      a: "Meet in a busy public place, check the item before you pay, and never send money in advance. You can report any suspicious ad and our team will review it.",
    },
  ];
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: c.url })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ];

  // Related pages, so people (and search engines) can move around easily.
  const related: { title: string; links: { href: string; label: string }[] }[] = [];
  if (l.category && l.category.subcategories.length) {
    related.push({
      title: `${l.category.name} in ${l.country.name}`,
      links: l.category.subcategories.map((s) => ({ href: landingPath(l.country.code, l.category!.slug, s.slug), label: landingSubject({ category: l.category, sub: s }) })),
    });
  }
  if (!l.category) {
    related.push({
      title: `Popular in ${where}`,
      links: [
        ["vehicles", "suvs"],
        ["vehicles", "utes"],
        ["property", "for-rent"],
        ["property", "for-sale"],
        ["property", "land-sale"],
        ["jobs", ""],
        ["electronics", "phones"],
        ["home-garden", "furniture"],
        ["boats", ""],
        ["services", ""],
      ].map(([c, s]) => ({
        href: landingPath(l.country.code, c, s || undefined),
        label: landingSubject({ category: categoryBySlug(c), sub: s ? subcategoryBySlug(c, s) : undefined }),
      })),
    });
  }
  if (towns.length > 1) {
    related.push({ title: `Towns in ${l.country.name}`, links: towns.map((t) => ({ href: landingPath(l.country.code, slugify(t)), label: `Buy and sell in ${t}` })) });
  }
  related.push({
    title: l.category ? `${l.category.name} in other countries` : "Other countries",
    links: COUNTRIES.filter((c) => c.code !== l.country.code).map((c) => ({
      href: landingPath(c.code, l.category?.slug, l.sub?.slug),
      label: `${c.flag} ${l.category ? landingSubject(l) : "Buy and sell"} in ${c.name}`,
    })),
  });

  return (
    <SearchResults
      filters={filters}
      basePath="/search"
      pagePath={self}
      landingCountry={l.country.code}
      title={title}
      intro={<p>{landingDescription(l, 0).replace(/^Browse /, "Find ")}</p>}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <section className="mt-16 grid gap-10 border-t border-line pt-10 lg:grid-cols-[1fr_1fr]">
        <div>
          <h2 className="font-display text-xl font-semibold">Questions</h2>
          <dl className="mt-4 space-y-5">
            {faqs.map((f) => (
              <div key={f.q}>
                <dt className="font-medium text-ink">{f.q}</dt>
                <dd className="mt-1 text-sm text-muted">{f.a}</dd>
              </div>
            ))}
          </dl>
          <Link href="/post" className="btn-accent mt-6">
            List an item free
          </Link>
        </div>
        <div className="space-y-8">
          {related.map((r) => (
            <nav key={r.title} aria-label={r.title}>
              <h2 className="font-display text-base font-semibold">{r.title}</h2>
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                {r.links.map((x) => (
                  <li key={x.href}>
                    <Link href={x.href} className="text-ink-2 underline-offset-4 hover:text-lagoon-700 hover:underline">
                      {x.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </section>
    </SearchResults>
  );
}
