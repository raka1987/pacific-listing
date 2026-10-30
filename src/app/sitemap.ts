import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { CATEGORIES, SITE } from "@/lib/constants";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigProblem } from "@/lib/supabase/env";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages = ["", "/search", "/about", "/contact", "/safety", "/notices", "/terms", "/privacy"].map((path) => ({
    url: `${SITE.url}${path}`,
    changeFrequency: "daily" as const,
    priority: path === "" ? 1 : 0.5,
  }));
  const categories = CATEGORIES.map((c) => ({ url: `${SITE.url}/category/${c.slug}`, changeFrequency: "hourly" as const, priority: 0.8 }));

  // Listing pages are added when the database is reachable; the sitemap still works without them.
  let listings: MetadataRoute.Sitemap = [];
  if (!supabaseConfigProblem()) {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const { data } = await supabase
        .from("listings")
        .select("id, updated_at")
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(5000);
      listings = (data ?? []).map((l) => ({ url: `${SITE.url}/listing/${l.id}`, lastModified: l.updated_at, priority: 0.6 }));
    } catch (e) {
      console.error("sitemap: could not load listings", e);
    }
  }

  return [...staticPages, ...categories, ...listings];
}
