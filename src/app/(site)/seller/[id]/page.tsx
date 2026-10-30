import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeCheck, CalendarDays, MapPin, Store } from "lucide-react";
import { isBusiness } from "@/lib/format";
import { Avatar } from "@/components/avatar";
import { EmptyState } from "@/components/empty-state";
import { ListingGrid } from "@/components/listing-card";
import { formatDate, locationLabel } from "@/lib/format";
import { getFavoriteIds } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { LISTING_CARD_COLUMNS, PROFILE_COLUMNS, type ListingCardData, type Profile } from "@/lib/types";

type Props = { params: Promise<{ id: string }> };

async function getSeller(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", id).maybeSingle<Profile>();
  return data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const seller = await getSeller((await params).id);
  return { title: seller ? `${seller.full_name || "Seller"}'s listings` : "Seller not found" };
}

export default async function SellerPage({ params }: Props) {
  const { id } = await params;
  const seller = await getSeller(id);
  if (!seller || seller.is_banned) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data }, favoriteIds] = await Promise.all([
    supabase.from("listings").select(LISTING_CARD_COLUMNS).eq("user_id", id).in("status", ["active", "sold"]).order("created_at", { ascending: false }),
    getFavoriteIds(supabase, user?.id),
  ]);
  const listings = (data ?? []) as ListingCardData[];
  const business = isBusiness(seller.business_until) ? seller.business_name : null;
  const name = business || seller.full_name || "Pacific Listing member";

  return (
    <div className="container-page py-8">
      <div className="card mb-8 flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
        <Avatar name={name} url={seller.avatar_url} size={88} />
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-ink">
            {name}
            {seller.is_verified && <BadgeCheck className="h-6 w-6 text-lagoon-600" aria-label="Verified seller" />}
          </h1>
          {business && (
            <span className="badge mt-1 bg-lagoon-100 text-lagoon-700">
              <Store className="h-3 w-3" /> Business seller
            </span>
          )}
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted">
            {seller.country && (
              <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {locationLabel(seller.country, seller.city)}</span>
            )}
            <span className="flex items-center gap-1"><CalendarDays className="h-4 w-4" /> Member since {formatDate(seller.created_at)}</span>
            <span className="flex items-center gap-1"><Store className="h-4 w-4" /> {listings.length} ads</span>
          </div>
          {seller.bio && <p className="mt-3 max-w-2xl text-ink-2">{seller.bio}</p>}
        </div>
      </div>
      {listings.length ? (
        <ListingGrid listings={listings} favoriteIds={favoriteIds} />
      ) : (
        <EmptyState icon={Store} title="No ads right now" description="This seller doesn't have any live ads." />
      )}
    </div>
  );
}
