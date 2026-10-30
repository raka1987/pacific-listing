import Link from "next/link";
import { CATEGORIES } from "@/lib/constants";
import { CategoryIcon } from "./category-icon";

/** One-tap category switcher for search and category pages. Keeps the search words and country. */
export function CategoryChips({ active, q, country }: { active?: string; q?: string; country?: string }) {
  const keep = new URLSearchParams();
  if (q) keep.set("q", q);
  if (country) keep.set("country", country);
  const qs = keep.size ? `?${keep}` : "";
  const chip = (on: boolean) =>
    `inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition ${
      on ? "border-ink bg-ink text-canvas" : "border-line bg-surface text-ink-2 hover:border-faint hover:text-ink"
    }`;
  return (
    <nav aria-label="Categories" className="scrollbar-none -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
      <Link href={`/search${qs}`} className={chip(!active)} aria-current={!active ? "page" : undefined}>
        All
      </Link>
      {CATEGORIES.map((c) => (
        <Link key={c.slug} href={`/category/${c.slug}${qs}`} className={chip(active === c.slug)} aria-current={active === c.slug ? "page" : undefined}>
          <CategoryIcon icon={c.icon} className="h-3.5 w-3.5" />
          {c.name}
        </Link>
      ))}
    </nav>
  );
}
