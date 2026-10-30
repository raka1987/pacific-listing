import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Camera } from "lucide-react";
import { AdBanner } from "@/components/ad-banner";
import { CategoryTiles } from "@/components/category-tiles";
import { InstallAppCard } from "@/components/install-app";
import { ListingGrid, ListingRail } from "@/components/listing-card";
import { SearchBar } from "@/components/search-bar";
import { COUNTRIES } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { getViewer } from "@/lib/location";
import { getFavoriteIds } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { LISTING_CARD_COLUMNS, type ListingCardData, type Notice } from "@/lib/types";

export const revalidate = 60;

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [featured, latest, notices, favoriteIds, viewer] = await Promise.all([
    supabase
      .from("listings")
      .select(LISTING_CARD_COLUMNS)
      .eq("status", "active")
      .eq("is_featured", true)
      .order("sort_at", { ascending: false })
      .limit(8),
    supabase.from("listings").select(LISTING_CARD_COLUMNS).eq("status", "active").order("sort_at", { ascending: false }).limit(12),
    supabase.from("notices").select("*").eq("is_published", true).order("created_at", { ascending: false }).limit(3),
    getFavoriteIds(supabase, user?.id),
    getViewer(),
  ]);

  const featuredListings = (featured.data ?? []) as ListingCardData[];
  const latestListings = (latest.data ?? []) as ListingCardData[];
  const noticeList = (notices.data ?? []) as Notice[];

  return (
    <>
      {/* Hero */}
      <section className="container-page pt-3 sm:pt-5">
        <div className="relative isolate overflow-hidden rounded-3xl bg-ocean-900">
          <Image src="/images/hero.jpg" alt="" fill priority sizes="100vw" className="-z-10 object-cover object-[70%_center]" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-ocean-950/60 to-ocean-950/70 sm:bg-gradient-to-r sm:from-ocean-950/85 sm:via-ocean-950/45 sm:to-transparent" />
          <div className="px-5 py-14 sm:px-12 sm:py-24 lg:px-16 lg:py-28">
            <div className="max-w-3xl">
              <h1 className="font-display max-w-xl text-4xl leading-[1.05] font-semibold text-white sm:text-6xl">Buy and sell across the Pacific</h1>
              <p className="mt-4 max-w-xl text-base text-white/75 sm:text-lg">Cars, homes, jobs and everyday deals from people in your community.</p>
              <div className="mt-8">
                <Suspense>
                  <SearchBar size="lg" withCategory withCountry defaultCountry={viewer.pacificCountry} />
                </Suspense>
              </div>
              <p className="mt-4 text-sm text-white/60">
                Try{" "}
                {["Toyota", "House for rent", "iPhone", "Boat"].map((t, i, all) => (
                  <span key={t}>
                    <Link href={`/search?q=${encodeURIComponent(t)}`} className="text-white/85 underline-offset-4 hover:text-white hover:underline">
                      {t}
                    </Link>
                    {i < all.length - 1 ? ", " : ""}
                  </span>
                ))}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="container-page mt-14 sm:mt-20">
        <SectionTitle title="Categories" href="/search" />
        <CategoryTiles />
      </section>

      {/* Featured */}
      {featuredListings.length > 0 && (
        <section className="container-page mt-16 sm:mt-24">
          <SectionTitle title="Featured" href="/search" />
          <ListingRail listings={featuredListings.slice(0, 4)} favoriteIds={favoriteIds} />
        </section>
      )}

      <section className="container-page mt-16 sm:mt-24">
        <AdBanner slot="home_banner" />
      </section>

      {/* Latest */}
      <section className="container-page mt-16 sm:mt-24">
        <SectionTitle title="Latest listings" href="/search" />
        {latestListings.length ? (
          <ListingGrid listings={latestListings} favoriteIds={favoriteIds} />
        ) : (
          <div className="card flex flex-col items-center px-6 py-14 text-center">
            <Camera className="h-8 w-8 text-faint" />
            <h3 className="font-display mt-4 text-xl font-semibold">Be one of the first to post</h3>
            <p className="mt-1 max-w-sm text-sm text-muted">It takes about a minute and it&apos;s free.</p>
            <Link href="/post" className="btn-accent mt-5">
              Post your first ad
            </Link>
          </div>
        )}
        <div className="mt-10 flex justify-center">
          <Link href="/search" className="btn-secondary px-6">
            Browse all listings
          </Link>
        </div>
      </section>

      {/* Sell */}
      <section className="container-page mt-20 sm:mt-28">
        <div className="grid gap-10 rounded-3xl bg-subtle p-7 sm:p-12 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:p-14">
          <div>
            <h2 className="font-display text-3xl font-semibold sm:text-4xl">Selling something?</h2>
            <p className="mt-3 max-w-md text-ink-2">Post for free in about a minute. Buyers call or WhatsApp you directly, with no fees on the sale.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/post" className="btn-accent px-6 py-3">
                Post an ad
              </Link>
              <Link href="/safety" className="btn-secondary px-6 py-3">
                Safety tips
              </Link>
            </div>
          </div>
          <ol className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line">
            {[
              ["Add photos and a price", "Up to 8 photos. Set your location so local buyers find you."],
              ["Buyers get in touch", "They call or message you on WhatsApp. No middleman."],
              ["Meet and sell safely", "Meet somewhere public and check the money before handing over."],
            ].map(([title, text], i) => (
              <li key={title} className="flex gap-4 bg-surface p-5">
                <span className="font-display text-sm font-semibold text-faint tabular-nums">{i + 1}</span>
                <span>
                  <span className="block font-medium text-ink">{title}</span>
                  <span className="text-sm text-muted">{text}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Notice board */}
      {noticeList.length > 0 && (
        <section className="container-page mt-20 sm:mt-24">
          <SectionTitle title="Notice board" href="/notices" />
          <div className="grid gap-x-8 gap-y-6 border-t border-line pt-6 md:grid-cols-3">
            {noticeList.map((n) => (
              <Link key={n.id} href={`/notices#${n.id}`} className="group">
                <p className="text-xs text-muted">{formatDate(n.created_at)}</p>
                <h3 className="mt-1 font-medium text-ink group-hover:text-lagoon-700">{n.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-muted">{n.body}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Countries + app */}
      <section className="container-page mt-20 grid gap-8 sm:mt-24 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <h2 className="font-display text-2xl font-semibold">Browse by country</h2>
          <div className="mt-5 flex flex-wrap gap-2">
            {COUNTRIES.map((c) => (
              <Link key={c.code} href={`/search?country=${c.code}`} className="chip">
                <span>{c.flag}</span>
                {c.name}
              </Link>
            ))}
          </div>
        </div>
        <InstallAppCard />
      </section>
    </>
  );
}

function SectionTitle({ title, href }: { title: string; href?: string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <h2 className="font-display text-2xl font-semibold sm:text-[28px]">{title}</h2>
      {href && (
        <Link href={href} className="group flex shrink-0 items-center gap-1 text-sm text-muted hover:text-ink">
          See all <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
