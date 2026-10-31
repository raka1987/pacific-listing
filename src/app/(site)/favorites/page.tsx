import type { Metadata } from "next";
import Link from "next/link";
import { Heart } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { ListingGrid } from "@/components/listing-card";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LISTING_CARD_COLUMNS, type ListingCardData } from "@/lib/types";

export const metadata: Metadata = { title: "Saved ads", robots: { index: false } };

export default async function FavoritesPage() {
  const { user } = await requireUser("/favorites");
  const supabase = await createClient();
  const { data } = await supabase
    .from("favorites")
    .select(`created_at, listing:listings(${LISTING_CARD_COLUMNS})`)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const listings = (data ?? []).map((r) => r.listing as unknown as ListingCardData | null).filter((l): l is ListingCardData => !!l);
  const ids = new Set(listings.map((l) => l.id));

  return (
    <div className="container-page py-8">
      <PageHeader
        title="Saved ads"
        description="Ads you've tapped the heart on. We'll email you if the price drops."
        action={<Link href="/saved-searches" className="btn-secondary">Saved searches</Link>}
      />
      {listings.length ? (
        <ListingGrid listings={listings} favoriteIds={ids} />
      ) : (
        <EmptyState
          icon={Heart}
          title="No saved ads yet"
          description="Tap the heart on any ad to save it here for later."
          action={<Link href="/search" className="btn-primary">Browse listings</Link>}
        />
      )}
    </div>
  );
}
