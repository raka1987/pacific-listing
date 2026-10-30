import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { CATEGORIES, COUNTRIES, SITE } from "@/lib/constants";
import { landingPath, slugify, TOWNS } from "@/lib/places";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigProblem } from "@/lib/supabase/env";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const page = (path: string, priority: number, changeFrequency: "hourly" | "daily" | "weekly" = "daily") => ({
    url: `${SITE.url}${path}`,
    changeFrequency,
    priority,
  });
  const staticPages = [
    page("", 1),
    page("/search", 0.6),
    page("/sell", 0.7, "weekly"),
    ...["/about", "/contact", "/safety", "/notices", "/business", "/advertise", "/terms", "/privacy"].map((p) => page(p, 0.4, "weekly")),
  ];
  const categories = CATEGORIES.map((c) => page(`/category/${c.slug}`, 0.7, "hourly"));
  // Every country's main page is always listed.
  const countries = COUNTRIES.map((c) => page(landingPath(c.code), 0.8, "hourly"));

  // Listings, plus the category / type / town pages that actually have ads.
  let listings: MetadataRoute.Sitemap = [];
  const landings: MetadataRoute.Sitemap = [];
  if (!supabaseConfigProblem()) {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const { data } = await supabase
        .from("listings")
        .select("id, updated_at, country, category, subcategory, city")
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(5000);
      const rows = data ?? [];
      listings = rows.map((l) => ({ url: `${SITE.url}/listing/${l.id}`, lastModified: l.updated_at, priority: 0.6 }));
      const seen = new Set<string>();
      for (const l of rows) {
        const paths = [landingPath(l.country, l.category)];
        if (l.subcategory) paths.push(landingPath(l.country, l.category, l.subcategory));
        const town = (TOWNS[l.country] ?? []).find((t) => (l.city ?? "").toLowerCase().includes(t.toLowerCase()));
        if (town) paths.push(landingPath(l.country, slugify(town)));
        for (const p of paths) {
          if (!seen.has(p)) {
            seen.add(p);
            landings.push(page(p, 0.7, "hourly"));
          }
        }
      }
    } catch (e) {
      console.error("sitemap: could not load listings", e);
    }
  }

  return [...staticPages, ...countries, ...categories, ...landings, ...listings];
}
