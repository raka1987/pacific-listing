import type { SupabaseClient } from "@supabase/supabase-js";
import { PAGE_SIZE } from "./constants";
import { LISTING_CARD_COLUMNS, type ListingCardData } from "./types";

export type SearchFilters = {
  q?: string;
  category?: string;
  country?: string;
  city?: string;
  min?: string;
  max?: string;
  condition?: string;
  sort?: string;
  page?: string;
};

/** Strip characters that have meaning in PostgREST filter syntax. */
function cleanTerm(q: string) {
  return q.replace(/["\\(),*%:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

export async function searchListings(supabase: SupabaseClient, f: SearchFilters) {
  const page = Math.max(1, Number(f.page) || 1);
  let query = supabase
    .from("listings")
    .select(LISTING_CARD_COLUMNS, { count: "exact" })
    .eq("status", "active");

  const term = f.q ? cleanTerm(f.q) : "";
  if (term) query = query.or(`title.ilike."*${term}*",search.wfts(english)."${term}"`);
  if (f.category) query = query.eq("category", f.category);
  if (f.country) query = query.eq("country", f.country);
  if (f.city) query = query.ilike("city", `%${cleanTerm(f.city)}%`);
  if (f.condition === "new" || f.condition === "used") query = query.eq("condition", f.condition);
  if (f.min && !isNaN(Number(f.min))) query = query.gte("price", Number(f.min));
  if (f.max && !isNaN(Number(f.max))) query = query.lte("price", Number(f.max));

  switch (f.sort) {
    case "price_asc":
      query = query.order("price", { ascending: true, nullsFirst: false });
      break;
    case "price_desc":
      query = query.order("price", { ascending: false, nullsFirst: false });
      break;
    case "oldest":
      query = query.order("sort_at", { ascending: true });
      break;
    default:
      query = query.order("is_featured", { ascending: false }).order("sort_at", { ascending: false });
  }

  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await query.range(from, from + PAGE_SIZE - 1);
  if (error) console.error("searchListings", error);
  return {
    listings: (data ?? []) as ListingCardData[],
    total: count ?? 0,
    page,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE)),
  };
}

export async function getFavoriteIds(supabase: SupabaseClient, userId: string | undefined) {
  if (!userId) return new Set<string>();
  const { data } = await supabase.from("favorites").select("listing_id").eq("user_id", userId);
  return new Set((data ?? []).map((r) => r.listing_id as string));
}
