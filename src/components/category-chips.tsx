import Link from "next/link";
import { CATEGORIES, categoryBySlug } from "@/lib/constants";
import { landingPath } from "@/lib/places";
import { CategoryIcon } from "./category-icon";

/** One-tap category switcher for search and category pages. Keeps the search words and country. */
export function CategoryChips({ active, q, country, landingCountry }: { active?: string; q?: string; country?: string; landingCountry?: string }) {
  const keep = new URLSearchParams();
  if (q) keep.set("q", q);
  if (country && !landingCountry) keep.set("country", country);
  const qs = keep.size ? `?${keep}` : "";
  const allHref = landingCountry ? `${landingPath(landingCountry)}${qs}` : `/search${qs}`;
  const catHref = (slug: string) => (landingCountry ? `${landingPath(landingCountry, slug)}${qs}` : `/category/${slug}${qs}`);
  const chip = (on: boolean) =>
    `inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition ${
      on ? "border-ink bg-ink text-canvas" : "border-line bg-surface text-ink-2 hover:border-faint hover:text-ink"
    }`;
  return (
    <nav aria-label="Categories" className="scrollbar-none -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
      <Link href={allHref} className={chip(!active)} aria-current={!active ? "page" : undefined}>
        All
      </Link>
      {CATEGORIES.map((c) => (
        <Link key={c.slug} href={catHref(c.slug)} className={chip(active === c.slug)} aria-current={active === c.slug ? "page" : undefined}>
          <CategoryIcon icon={c.icon} className="h-3.5 w-3.5" />
          {c.name}
        </Link>
      ))}
    </nav>
  );
}

/** The types within one category, e.g. For sale / For rent under Property. */
export function SubcategoryChips({
  category,
  active,
  q,
  country,
  landingCountry,
}: {
  category: string;
  active?: string;
  q?: string;
  country?: string;
  landingCountry?: string;
}) {
  const cat = categoryBySlug(category);
  if (!cat?.subcategories.length) return null;
  const href = (sub?: string) => {
    if (landingCountry) return `${landingPath(landingCountry, cat.slug, sub)}${q ? `?q=${encodeURIComponent(q)}` : ""}`;
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (country) p.set("country", country);
    if (sub) p.set("sub", sub);
    return `/category/${cat.slug}${p.size ? `?${p}` : ""}`;
  };
  const chip = (on: boolean) =>
    `inline-flex shrink-0 items-center rounded-full px-3 py-1 text-[13px] transition ${
      on ? "bg-lagoon-600 font-medium text-white" : "bg-subtle text-ink-2 hover:bg-line hover:text-ink"
    }`;
  return (
    <nav aria-label={`Types of ${cat.name}`} className="scrollbar-none -mx-4 -mt-3 mb-6 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
      <Link href={href()} className={chip(!active)} aria-current={!active ? "page" : undefined}>
        All {cat.name.toLowerCase()}
      </Link>
      {cat.subcategories.map((s) => (
        <Link key={s.slug} href={href(s.slug)} className={chip(active === s.slug)} aria-current={active === s.slug ? "page" : undefined}>
          {s.name}
        </Link>
      ))}
    </nav>
  );
}
