import { getAuthUser, getCurrentUser, MOD_ROLES } from "@/lib/auth";
import { deleteReview } from "@/app/alerts-actions";
import { RatingSummary, Stars } from "@/components/stars";
import { SubmitButton } from "@/components/submit-button";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeCheck, CalendarDays, MapPin, Star, Store, Trash2 } from "lucide-react";
import { isBusiness } from "@/lib/format";
import { Avatar } from "@/components/avatar";
import { EmptyState } from "@/components/empty-state";
import { ListingGrid } from "@/components/listing-card";
import { formatDate, locationLabel, timeAgo } from "@/lib/format";
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
  const user = await getAuthUser();
  const [{ data }, favoriteIds, { data: rating }, { data: reviewRows }, current] = await Promise.all([
    supabase.from("listings").select(LISTING_CARD_COLUMNS).eq("user_id", id).in("status", ["active", "sold"]).order("created_at", { ascending: false }),
    getFavoriteIds(supabase, user?.id),
    supabase.from("member_ratings").select("average, total").eq("member_id", id).maybeSingle(),
    supabase
      .from("reviews")
      .select("id, rating, comment, created_at, reviewer_id, reviewer:profiles!reviews_reviewer_id_fkey(full_name, avatar_url)")
      .eq("reviewee_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    getCurrentUser(),
  ]);
  const reviews = (reviewRows ?? []) as unknown as {
    id: string;
    rating: number;
    comment: string | null;
    created_at: string;
    reviewer_id: string;
    reviewer: { full_name: string; avatar_url: string | null } | null;
  }[];
  const isMod = !!current?.profile && MOD_ROLES.includes(current.profile.role);
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
          <div className="mt-2">
            <RatingSummary rating={rating as { average: number; total: number } | null} />
          </div>
          {seller.bio && <p className="mt-3 max-w-2xl text-ink-2">{seller.bio}</p>}
        </div>
      </div>
      {listings.length ? (
        <ListingGrid listings={listings} favoriteIds={favoriteIds} />
      ) : (
        <EmptyState icon={Store} title="No ads right now" description="This seller doesn't have any live ads." />
      )}

      <section className="mt-12" id="ratings">
        <h2 className="font-display flex items-center gap-2 text-2xl font-semibold text-ink">
          <Star className="h-5 w-5 text-amber-400" fill="currentColor" strokeWidth={0} /> Ratings
        </h2>
        <p className="mt-1 text-sm text-muted">From people who have chatted with {name.split(" ")[0]} on Pacific Listing.</p>
        {reviews.length ? (
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {reviews.map((r) => (
              <li key={r.id} className="card p-4">
                <div className="flex items-center gap-3">
                  <Avatar name={r.reviewer?.full_name || "Member"} url={r.reviewer?.avatar_url ?? null} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{r.reviewer?.full_name || "Member"}</p>
                    <p className="flex items-center gap-2 text-xs text-muted">
                      <Stars value={r.rating} size={13} /> {timeAgo(r.created_at)}
                    </p>
                  </div>
                  {(isMod || r.reviewer_id === user?.id) && (
                    <form action={deleteReview.bind(null, r.id, id)}>
                      <SubmitButton className="flex h-8 w-8 items-center justify-center rounded-full text-faint hover:bg-subtle hover:text-red-600">
                        <Trash2 className="h-4 w-4" aria-label="Delete rating" />
                      </SubmitButton>
                    </form>
                  )}
                </div>
                {r.comment && <p className="mt-3 text-sm whitespace-pre-line text-ink-2">{r.comment}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-2xl bg-subtle p-4 text-sm text-muted">
            No ratings yet. After chatting about an ad, either person can leave a rating from the chat menu.
          </p>
        )}
      </section>
    </div>
  );
}
