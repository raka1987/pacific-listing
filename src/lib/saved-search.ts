import { categoryBySlug, countryByCode, subcategoryBySlug } from "./constants";

export type SavedSearch = {
  id: string;
  q: string | null;
  category: string | null;
  sub: string | null;
  country: string | null;
  city: string | null;
  min_price: number | null;
  max_price: number | null;
  condition: string | null;
  alerts: boolean;
  created_at: string;
};

type Row = Omit<SavedSearch, "id" | "alerts" | "created_at">;

/** "“hilux” in Vehicles · Utes · Fiji · Suva · 10,000–30,000 · Used" */
export function describeSearch(s: Row) {
  const parts: string[] = [];
  const cat = categoryBySlug(s.category ?? undefined);
  const sub = subcategoryBySlug(s.category ?? undefined, s.sub ?? undefined);
  parts.push(s.q ? `“${s.q}”${cat ? ` in ${cat.name}` : ""}` : (cat?.name ?? "All ads"));
  if (sub) parts.push(sub.name);
  parts.push(s.country ? (countryByCode(s.country)?.name ?? s.country) : "All Pacific");
  if (s.city) parts.push(s.city);
  const n = (v: number) => Number(v).toLocaleString("en");
  if (s.min_price != null && s.max_price != null) parts.push(`${n(s.min_price)}–${n(s.max_price)}`);
  else if (s.max_price != null) parts.push(`up to ${n(s.max_price)}`);
  else if (s.min_price != null) parts.push(`from ${n(s.min_price)}`);
  if (s.condition) parts.push(s.condition === "new" ? "New" : "Used");
  return parts.join(" · ");
}

/** The results page for a saved search. */
export function searchHref(s: Row) {
  const p = new URLSearchParams();
  if (s.q) p.set("q", s.q);
  if (s.sub) p.set("sub", s.sub);
  if (s.country) p.set("country", s.country);
  if (s.city) p.set("city", s.city);
  if (s.min_price != null) p.set("min", String(s.min_price));
  if (s.max_price != null) p.set("max", String(s.max_price));
  if (s.condition) p.set("condition", s.condition);
  const base = s.category ? `/category/${s.category}` : "/search";
  return `${base}${p.size ? `?${p}` : ""}`;
}
