import Link from "next/link";
import { Megaphone } from "lucide-react";
import { getViewer } from "@/lib/location";
import { createClient } from "@/lib/supabase/server";
import { AdImpression } from "./ad-impression";

type Ad = { id: string; title: string; image_url: string | null; link_url: string | null; advertiser_name: string };

/**
 * A paid banner for one ad spot. When nothing is booked it shows a
 * "your ad here" placeholder that links to the advertising page.
 */
export async function AdBanner({
  slot,
  category,
  compact = false,
  tall = false,
}: {
  slot: "home_banner" | "category_top" | "listing_sidebar";
  category?: string;
  compact?: boolean;
  tall?: boolean;
}) {
  const supabase = await createClient();
  // Country-targeted banners only reach visitors in those countries; global ones reach everyone.
  const { pacificCountry } = await getViewer();
  const { data } = await supabase.rpc("get_ad", { p_slot: slot, p_country: pacificCountry, p_category: category ?? null });
  const ad = (data as Ad[] | null)?.[0];
  // Phones get a slightly taller crop, anchored left where advertisers put their text.
  const aspect = tall ? "aspect-[4/3]" : compact ? "aspect-[4/1] sm:aspect-[16/3]" : "aspect-[3/1] sm:aspect-[4/1]";

  if (!ad) {
    return (
      <Link
        href="/advertise"
        className={`group flex ${tall ? "aspect-[4/3] flex-col justify-center text-center" : "min-h-24 items-center"} gap-4 rounded-3xl border border-dashed border-line bg-surface p-5 transition hover:border-lagoon-300 hover:bg-lagoon-50`}
      >
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-lagoon-100 text-lagoon-700 ${tall ? "mx-auto" : ""}`}>
          <Megaphone className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block font-semibold text-ink">Advertise your business here</span>
          <span className="text-sm text-muted">Reach buyers across the Pacific. See prices and book a spot.</span>
        </span>
      </Link>
    );
  }

  return (
    <figure className="relative">
      <a href={`/ad/${ad.id}`} target="_blank" rel="sponsored noopener" className={`group relative block overflow-hidden rounded-3xl bg-subtle ${aspect}`}>
        {ad.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ad.image_url} alt={ad.title} loading="lazy" className="h-full w-full object-cover object-left transition duration-500 group-hover:scale-[1.02]" />
        ) : (
          <span className="flex h-full items-center justify-center p-6 text-center font-display text-2xl font-bold text-ink">{ad.title}</span>
        )}
      </a>
      <figcaption className="mt-1.5 flex items-center justify-between gap-2 px-1 text-[11px] text-faint">
        <span>
          Sponsored · {ad.advertiser_name}
        </span>
        <Link href="/advertise" className="hover:text-ink">
          Advertise with us
        </Link>
      </figcaption>
      <AdImpression id={ad.id} />
    </figure>
  );
}
