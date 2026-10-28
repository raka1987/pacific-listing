import Link from "next/link";
import { ImageIcon, MapPin, Sparkles } from "lucide-react";
import { categoryBySlug } from "@/lib/constants";
import { formatPrice, locationLabel, timeAgo } from "@/lib/format";
import type { ListingCardData } from "@/lib/types";
import { FavoriteButton } from "./favorite-button";

export function ListingCard({ listing, isFavorite }: { listing: ListingCardData; isFavorite?: boolean }) {
  const cover = listing.images[0];
  const category = categoryBySlug(listing.category);
  return (
    <article className="group card relative flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/70">
      <Link href={`/listing/${listing.id}`} className="relative block aspect-[4/3] overflow-hidden bg-slate-100">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={listing.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-300">
            <ImageIcon className="h-10 w-10" />
          </div>
        )}
        <div className="absolute top-2.5 left-2.5 flex gap-1.5">
          {listing.is_featured && (
            <span className="badge bg-coral-500 text-white shadow">
              <Sparkles className="h-3 w-3" /> Featured
            </span>
          )}
          {listing.status === "sold" && <span className="badge bg-slate-900/80 text-white">Sold</span>}
        </div>
        {listing.images.length > 1 && (
          <span className="badge absolute right-2.5 bottom-2.5 bg-black/55 text-white">
            <ImageIcon className="h-3 w-3" /> {listing.images.length}
          </span>
        )}
      </Link>
      <div className="absolute top-2 right-2">
        <FavoriteButton listingId={listing.id} initial={!!isFavorite} />
      </div>
      <div className="flex flex-1 flex-col p-3.5">
        <p className="text-base font-bold text-ocean-900">
          {formatPrice(listing.price, listing.price_type, listing.country)}
        </p>
        <h3 className="mt-0.5 line-clamp-2 text-sm font-medium text-slate-700">
          <Link href={`/listing/${listing.id}`} className="after:absolute after:inset-0 after:content-[''] hover:text-lagoon-700">
            {listing.title}
          </Link>
        </h3>
        <div className="mt-auto flex items-center justify-between gap-2 pt-3 text-xs text-slate-500">
          <span className="flex min-w-0 items-center gap-1">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{locationLabel(listing.country, listing.city)}</span>
          </span>
          <span className="shrink-0">{timeAgo(listing.created_at)}</span>
        </div>
        {category && <span className="sr-only">Category: {category.name}</span>}
      </div>
    </article>
  );
}

export function ListingGrid({
  listings,
  favoriteIds,
}: {
  listings: ListingCardData[];
  favoriteIds?: Set<string>;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
      {listings.map((l) => (
        <ListingCard key={l.id} listing={l} isFavorite={favoriteIds?.has(l.id)} />
      ))}
    </div>
  );
}
