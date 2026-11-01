import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Sparkles, Zap } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { currencyFor } from "@/lib/constants";
import { formatDate, formatPrice, isBusiness } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { LISTING_COLUMNS, type BoostPackage, type Listing, type Plan } from "@/lib/types";
import { PromoteForm } from "./form";

export const metadata: Metadata = { title: "Promote your ad", robots: { index: false } };

export default async function PromotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, profile } = await requireUser(`/promote/${id}`);
  const supabase = await createClient();
  const [{ data: listing }, { data: packages }, { data: settings }] = await Promise.all([
    supabase.from("listings").select(LISTING_COLUMNS).eq("id", id).maybeSingle<Listing>(),
    supabase.from("boost_packages").select("*").eq("is_active", true).order("sort"),
    supabase.from("site_settings").select("card_payments_enabled").eq("id", 1).single(),
  ]);
  if (!listing || listing.user_id !== user.id) notFound();

  // Free bumps left this period for business accounts
  let freeBumpsLeft = 0;
  if (profile && isBusiness(profile.business_until)) {
    const { data: plan } = await supabase.from("profiles").select("plan_id").eq("id", user.id).single();
    const { data: p } = await supabase.from("plans").select("*").eq("id", (plan as { plan_id?: string } | null)?.plan_id ?? "").maybeSingle<Plan>();
    if (p) {
      const since = new Date(new Date(profile.business_until!).getTime() - p.duration_days * 86400000).toISOString();
      const { count } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("method", "free")
        .eq("status", "paid")
        .gte("created_at", since);
      freeBumpsLeft = Math.max(0, p.free_bumps - (count ?? 0));
    }
  }

  return (
    <div className="container-page max-w-3xl py-8">
      <Link href="/my-ads" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> My ads
      </Link>
      <PageHeader title="Promote your ad" description="Get more views and sell faster." />
      <div className="card mb-6 flex items-center gap-4 p-3">
        <div className="h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-subtle">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {listing.images[0] && <img src={listing.images[0]} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{listing.title}</p>
          <p className="text-sm text-muted">{formatPrice(listing.price, listing.price_type, listing.country)}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {listing.is_featured && listing.featured_until && (
              <span className="badge bg-coral-400/15 text-coral-600"><Sparkles className="h-3 w-3" /> Featured until {formatDate(listing.featured_until)}</span>
            )}
            {listing.is_urgent && listing.urgent_until && (
              <span className="badge bg-red-100 text-red-700"><Zap className="h-3 w-3" /> Urgent until {formatDate(listing.urgent_until)}</span>
            )}
          </div>
        </div>
      </div>
      {listing.status !== "active" ? (
        <p className="card p-6 text-muted">Only live ads can be promoted. This ad is currently not live.</p>
      ) : (
        <PromoteForm
          listingId={listing.id}
          packages={(packages ?? []) as BoostPackage[]}
          currency={currencyFor(listing.country)}
          cardEnabled={!!settings?.card_payments_enabled}
          freeBumpsLeft={freeBumpsLeft}
        />
      )}
    </div>
  );
}
