import { getAuthUser } from "@/lib/auth";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { AdBanner } from "@/components/ad-banner";
import { AlertTriangle, Store, Zap, BadgeCheck, CalendarDays, CheckCircle2, ChevronRight, Clock, Eye, MapPin, ShieldCheck, Tag } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { ContactBar } from "@/components/contact-bar";
import { ContactSeller } from "@/components/contact-seller";
import { FavoriteButton } from "@/components/favorite-button";
import { ImageGallery } from "@/components/image-gallery";
import { approxPrice, ListingGrid } from "@/components/listing-card";
import { OwnerActions } from "@/components/owner-actions";
import { ReportDialog } from "@/components/report-dialog";
import { ShareButton } from "@/components/share-button";
import { ShareLinks } from "@/components/share-links";
import { StatusBadge } from "@/components/status-badge";
import { ViewTracker } from "@/components/view-tracker";
import { categoryBySlug, countryByCode, SITE, subcategoryBySlug } from "@/lib/constants";
import { formatDate, formatPrice, isBusiness, locationLabel, timeAgo } from "@/lib/format";
import { getFavoriteIds } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { LISTING_CARD_COLUMNS, type ListingCardData, type ListingWithSeller } from "@/lib/types";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ posted?: string; updated?: string; offer?: string }> };

const getListing = cache(async (id: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select("*, seller:profiles!listings_user_id_fkey(id, full_name, avatar_url, is_verified, created_at, phone, whatsapp, business_name, business_until)")
    .eq("id", id)
    .maybeSingle<ListingWithSeller>();
  return data;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const listing = await getListing((await params).id);
  if (!listing) return { title: "Listing not found" };
  const price = formatPrice(listing.price, listing.price_type, listing.country);
  const description = `${price} · ${locationLabel(listing.country, listing.city)}. ${listing.description.slice(0, 140)}`;
  return {
    title: listing.title,
    description,
    alternates: { canonical: `/listing/${listing.id}` },
    robots: listing.status === "active" || listing.status === "sold" ? undefined : { index: false },
    openGraph: { title: `${listing.title} — ${price}`, description, type: "article" },
  };
}

export default async function ListingPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { posted, updated, offer } = await searchParams;
  const listing = await getListing(id);
  if (!listing) notFound();

  const supabase = await createClient();
  const user = await getAuthUser();
  const isOwner = user?.id === listing.user_id;

  const [{ data: similar }, favoriteIds] = await Promise.all([
    supabase
      .from("listings")
      .select(LISTING_CARD_COLUMNS)
      .eq("status", "active")
      .eq("category", listing.category)
      .neq("id", listing.id)
      .order("created_at", { ascending: false })
      .limit(4),
    getFavoriteIds(supabase, user?.id),
  ]);

  const category = categoryBySlug(listing.category);
  const sub = subcategoryBySlug(listing.category, listing.subcategory);
  const country = countryByCode(listing.country);
  const approx = await approxPrice(listing);
  const url = `${SITE.url}/listing/${listing.id}`;
  const phone = listing.contact_phone || listing.seller?.phone || null;
  const whatsapp = listing.contact_whatsapp || listing.seller?.whatsapp || null;
  const business = isBusiness(listing.seller?.business_until) ? listing.seller?.business_name : null;
  const sellerName = business || listing.seller?.full_name || "Pacific Listing member";
  let feeOrderId: string | null = null;
  if (isOwner && listing.status === "awaiting_payment") {
    const { data: o } = await supabase.from("orders").select("id").eq("listing_id", listing.id).eq("kind", "posting_fee").eq("status", "awaiting_payment").maybeSingle();
    feeOrderId = o?.id ?? null;
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: listing.title,
    description: listing.description,
    image: listing.images,
    category: category?.name,
    offers:
      listing.price != null
        ? {
            "@type": "Offer",
            price: listing.price,
            priceCurrency: country?.currency ?? "USD",
            availability: listing.status === "sold" ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
            itemCondition: listing.condition === "new" ? "https://schema.org/NewCondition" : "https://schema.org/UsedCondition",
          }
        : undefined,
  };

  return (
    <div className="container-page pt-4 pb-28 sm:py-8 lg:pb-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      {!isOwner && <ViewTracker listingId={listing.id} />}

      <nav className="mb-4 hidden items-center gap-1 text-sm text-muted sm:flex" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-lagoon-700">Home</Link>
        <ChevronRight className="h-4 w-4" />
        {category && (
          <>
            <Link href={`/category/${category.slug}`} className="hover:text-lagoon-700">{category.name}</Link>
            <ChevronRight className="h-4 w-4" />
            {sub && (
              <>
                <Link href={`/category/${category.slug}?sub=${sub.slug}`} className="hover:text-lagoon-700">{sub.name}</Link>
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </>
        )}
        <span className="truncate text-ink-2">{listing.title}</span>
      </nav>

      {(posted || updated) && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-lagoon-200 bg-lagoon-50 p-4 text-lagoon-900">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-lagoon-600" />
          <div>
            <p className="font-semibold">{posted ? "Your ad has been posted!" : "Your changes have been saved."}</p>
            {offer && listing.featured_until && (
              <p className="mt-0.5 text-sm font-medium text-coral-600">
                Welcome offer: your first ad is featured free until {formatDate(listing.featured_until)}.
              </p>
            )}
            <p className="text-sm text-lagoon-800">
              {listing.status === "pending"
                ? "It's now waiting for a quick review by our team and will go live shortly."
                : "It's live now. Share it to your Facebook groups and WhatsApp to reach buyers faster."}
            </p>
            {listing.status === "active" && (
              <div className="mt-3">
                <ShareLinks url={url} text={`${listing.title} – ${formatPrice(listing.price, listing.price_type, listing.country)}. See photos and details on Pacific Listing:`} compact />
              </div>
            )}
          </div>
        </div>
      )}
      {isOwner && listing.status === "awaiting_payment" && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <p className="text-sm">
            <strong>Not live yet.</strong> This category has a posting fee. Your ad goes live once it&apos;s paid.
          </p>
          {feeOrderId && (
            <Link href={`/orders/${feeOrderId}`} className="hide-in-app btn-accent px-4 py-2 text-xs">
              Pay posting fee
            </Link>
          )}
        </div>
      )}
      {isOwner && listing.status === "rejected" && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">This ad wasn&apos;t approved</p>
            <p className="text-sm">{listing.rejection_reason || "It doesn't meet our posting rules."} Edit it to resubmit.</p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:gap-8">
        <div className="min-w-0 space-y-6">
          <ImageGallery images={listing.images} title={listing.title} />

          <section className="card p-5 sm:p-6">
            <h2 className="font-display text-xl font-semibold text-ink">Details</h2>
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Detail icon={Tag} label="Category" value={sub ? `${category?.name} · ${sub.name}` : (category?.name ?? listing.category)} />
              <Detail icon={MapPin} label="Location" value={locationLabel(listing.country, listing.city)} />
              {listing.condition && <Detail icon={BadgeCheck} label="Condition" value={listing.condition === "new" ? "New" : "Used"} />}
              <Detail icon={CalendarDays} label="Posted" value={formatDate(listing.created_at)} />
            </dl>
            <h2 className="font-display mt-8 text-xl font-semibold text-ink">Description</h2>
            <p className="mt-3 leading-relaxed whitespace-pre-line text-ink-2">
              {listing.description || "No description provided."}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-sm text-muted">
              <span className="flex items-center gap-4">
                <span className="flex items-center gap-1"><Eye className="h-4 w-4" /> {listing.views.toLocaleString()} views</span>
                <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {timeAgo(listing.created_at)}</span>
              </span>
              {!isOwner && <ReportDialog listingId={listing.id} />}
            </div>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:h-fit">
          <div className="card p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <p className="font-display text-3xl font-semibold text-ink sm:text-4xl">
                {formatPrice(listing.price, listing.price_type, listing.country)}
              </p>
              {listing.status !== "active" && <StatusBadge status={listing.status} />}
            </div>
            {approx && <p className="mt-0.5 text-sm text-muted">About {approx} · approximate conversion</p>}
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {listing.price_type === "negotiable" && <p className="text-sm font-medium text-lagoon-700">Price negotiable</p>}
              {listing.is_urgent && listing.status === "active" && (
                <span className="badge bg-red-600 text-white">
                  <Zap className="h-3 w-3" /> Urgent sale
                </span>
              )}
            </div>
            <h1 className="font-display mt-2 text-xl leading-snug font-semibold text-ink sm:text-2xl">{listing.title}</h1>
            <p className="mt-2 flex items-center gap-1 text-sm text-muted">
              <MapPin className="h-4 w-4" /> {locationLabel(listing.country, listing.city)}
            </p>

            <div className="mt-5">
              {isOwner ? (
                <OwnerActions id={listing.id} status={listing.status} />
              ) : listing.status === "sold" ? (
                <p className="rounded-xl bg-subtle p-3 text-center text-sm font-medium text-ink-2">This item has been sold.</p>
              ) : (
                <ContactSeller listingId={listing.id} phone={phone} whatsapp={whatsapp} title={listing.title} listingUrl={url} />
              )}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <FavoriteButton listingId={listing.id} initial={favoriteIds.has(listing.id)} variant="button" />
              <ShareButton title={listing.title} url={url} />
            </div>
            <div className="mt-4 border-t border-line pt-4">
              <p className="mb-2 text-xs font-medium text-muted">Share this ad</p>
              <ShareLinks url={url} text={`${listing.title} – ${formatPrice(listing.price, listing.price_type, listing.country)}:`} compact />
            </div>
          </div>

          {listing.seller && (
            <Link href={`/seller/${listing.seller.id}`} className="card flex items-center gap-3 p-4 transition hover:shadow-md">
              <Avatar name={sellerName} url={listing.seller.avatar_url} size={48} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 font-semibold text-ink">
                  <span className="truncate">{sellerName}</span>
                  {listing.seller.is_verified && <BadgeCheck className="h-4 w-4 shrink-0 text-lagoon-600" aria-label="Verified seller" />}
                </p>
                {business ? (
                  <p className="flex items-center gap-1 text-sm font-medium text-lagoon-700">
                    <Store className="h-3.5 w-3.5" /> Business seller
                  </p>
                ) : (
                  <p className="text-sm text-muted">Member since {formatDate(listing.seller.created_at)}</p>
                )}
              </div>
              <ChevronRight className="h-5 w-5 text-faint" />
            </Link>
          )}

          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            <p className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4" /> Stay safe</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-800">
              <li>Meet in a busy public place.</li>
              <li>Check the item before you pay.</li>
              <li>Never send money in advance.</li>
            </ul>
            <Link href="/safety" className="mt-2 inline-block font-semibold underline">More safety tips</Link>
          </div>
          <AdBanner slot="listing_sidebar" category={listing.category} tall />
        </aside>
      </div>

      {!isOwner && listing.status === "active" && (
        <ContactBar
          listingId={listing.id}
          price={formatPrice(listing.price, listing.price_type, listing.country)}
          phone={phone}
          whatsapp={whatsapp}
          title={listing.title}
          listingUrl={url}
        />
      )}

      {similar && similar.length > 0 && (
        <section className="mt-14">
          <h2 className="font-display mb-6 text-2xl font-semibold text-ink sm:text-3xl">Similar listings</h2>
          <ListingGrid listings={similar as ListingCardData[]} favoriteIds={favoriteIds} />
        </section>
      )}
    </div>
  );
}

function Detail({ icon: Icon, label, value }: { icon: typeof Tag; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-subtle p-3.5">
      <dt className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-faint uppercase">
        <Icon className="h-3.5 w-3.5" /> {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}
