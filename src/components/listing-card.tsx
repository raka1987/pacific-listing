import Link from "next/link";
import { Camera, ImageIcon, MapPin, Sparkles, Zap } from "lucide-react";
import { categoryBySlug, currencyFor } from "@/lib/constants";
import { convert, getViewer } from "@/lib/location";
import { formatMoney, formatPrice, locationLabel, timeAgo } from "@/lib/format";
import type { ListingCardData } from "@/lib/types";
import { FavoriteButton } from "./favorite-button";

export async function ListingCard({ listing, isFavorite }: { listing: ListingCardData; isFavorite?: boolean }) {
  const cover = listing.images[0];
  const category = categoryBySlug(listing.category);
  const approx = await approxPrice(listing);
  return (
    <article className="group relative flex flex-col">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-subtle sm:rounded-3xl">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={listing.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-faint">
            <ImageIcon className="h-10 w-10" />
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/30 to-transparent opacity-0 transition group-hover:opacity-100" />
        <div className="absolute top-2.5 left-2.5 flex gap-1.5">
          {listing.is_featured && (
            <span className="badge bg-white/95 text-coral-600 shadow-sm backdrop-blur">
              <Sparkles className="h-3 w-3" /> Featured
            </span>
          )}
          {listing.is_urgent && listing.status === "active" && (
            <span className="badge bg-red-600 text-white shadow-sm">
              <Zap className="h-3 w-3" /> Urgent
            </span>
          )}
          {listing.status === "sold" && <span className="badge bg-slate-900/85 text-white">Sold</span>}
        </div>
        {listing.images.length > 1 && (
          <span className="badge absolute bottom-2.5 left-2.5 bg-black/50 text-white backdrop-blur">
            <Camera className="h-3 w-3" /> {listing.images.length}
          </span>
        )}
        <div className="absolute top-2 right-2">
          <FavoriteButton listingId={listing.id} initial={!!isFavorite} />
        </div>
      </div>
      <div className="flex flex-1 flex-col px-0.5 pt-3">
        <p className="text-[15px] font-semibold tracking-tight text-ink">
          {formatPrice(listing.price, listing.price_type, listing.country)}
          {approx && <span className="ml-1.5 font-sans text-xs font-medium text-muted">≈ {approx}</span>}
        </p>
        <h3 className="mt-0.5 line-clamp-2 text-sm leading-snug text-ink-2">
          <Link href={`/listing/${listing.id}`} className="after:absolute after:inset-0 after:content-['']">
            {listing.title}
          </Link>
        </h3>
        <p className="mt-1.5 flex min-w-0 items-center gap-1 text-xs text-muted">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{locationLabel(listing.country, listing.city)}</span>
          <span className="shrink-0 text-faint">· {timeAgo(listing.created_at)}</span>
        </p>
        {category && <span className="sr-only">Category: {category.name}</span>}
      </div>
    </article>
  );
}

export function ListingGrid({ listings, favoriteIds }: { listings: ListingCardData[]; favoriteIds?: Set<string> }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4">
      {listings.map((l) => (
        <ListingCard key={l.id} listing={l} isFavorite={favoriteIds?.has(l.id)} />
      ))}
    </div>
  );
}

/** Horizontally scrolling row on phones, normal grid on larger screens. */
export function ListingRail({ listings, favoriteIds }: { listings: ListingCardData[]; favoriteIds?: Set<string> }) {
  return (
    <div className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-5 sm:overflow-visible sm:px-0 lg:grid-cols-4">
      {listings.map((l) => (
        <div key={l.id} className="w-[72%] shrink-0 snap-start sm:w-auto">
          <ListingCard listing={l} isFavorite={favoriteIds?.has(l.id)} />
        </div>
      ))}
    </div>
  );
}

export function ListingGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <div className="skeleton aspect-[4/3] sm:rounded-3xl" />
          <div className="skeleton mt-3 h-4 w-1/3 rounded-full" />
          <div className="skeleton mt-2 h-3.5 w-4/5 rounded-full" />
          <div className="skeleton mt-2 h-3 w-1/2 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** "FJD 2,450" when the ad is priced in another currency than the visitor's. */
export async function approxPrice(listing: Pick<ListingCardData, "price" | "price_type" | "country">) {
  if (listing.price == null || listing.price_type === "free" || listing.price_type === "contact") return null;
  const { currency } = await getViewer();
  const from = currencyFor(listing.country);
  if (from === currency) return null;
  const v = convert(Number(listing.price), from, currency);
  return v == null ? null : formatMoney(v, currency);
}
