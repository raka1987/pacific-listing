import { getAuthUser } from "@/lib/auth";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Camera, Clock, MessagesSquare, Sparkles, Tag } from "lucide-react";
import { AdBanner } from "@/components/ad-banner";
import { CategoryTiles } from "@/components/category-tiles";
import { getSearchCountry } from "@/lib/location";
import { InstallAppCard } from "@/components/install-app";
import { ListingGrid, ListingRail } from "@/components/listing-card";
import { SearchBar } from "@/components/search-bar";
import { COUNTRIES, SITE } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { landingPath } from "@/lib/places";
import { getFavoriteIds } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { LISTING_CARD_COLUMNS, type ListingCardData, type Notice } from "@/lib/types";

export const revalidate = 60;

export default async function HomePage() {
  const supabase = await createClient();
  const user = await getAuthUser();

  // Featured and latest ads come from the country the visitor picked (All Pacific if none).
  const searchCountry = await getSearchCountry();
  let featuredQ = supabase.from("listings").select(LISTING_CARD_COLUMNS).eq("status", "active").eq("is_featured", true);
  let latestQ = supabase.from("listings").select(LISTING_CARD_COLUMNS).eq("status", "active");
  if (searchCountry) {
    featuredQ = featuredQ.eq("country", searchCountry);
    latestQ = latestQ.eq("country", searchCountry);
  }
  const [featured, latest, notices, favoriteIds, offer] = await Promise.all([
    featuredQ.order("sort_at", { ascending: false }).limit(8),
    latestQ.order("sort_at", { ascending: false }).limit(12),
    supabase.from("notices").select("*").eq("is_published", true).order("created_at", { ascending: false }).limit(3),
    getFavoriteIds(supabase, user?.id),
    supabase.from("site_settings").select("launch_offer_days, free_ad_limit").eq("id", 1).maybeSingle(),
  ]);
  const offerDays = (offer.data as { launch_offer_days?: number } | null)?.launch_offer_days ?? 0;
  // "Free live ads per person" from Admin -> Settings (none set means no limit).
  const freeAds = (offer.data as { free_ad_limit?: number | null } | null)?.free_ad_limit ?? null;

  const countryName = COUNTRIES.find((c) => c.code === searchCountry)?.name ?? null;
  const searchHref = searchCountry ? `/search?country=${searchCountry}` : "/search";
  const featuredListings = (featured.data ?? []) as ListingCardData[];
  const latestListings = (latest.data ?? []) as ListingCardData[];
  const noticeList = (notices.data ?? []) as Notice[];

  // Tells Google and AI assistants what this site is and how to search it.
  const siteJsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE.name,
      url: SITE.url,
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${SITE.url}/search?q={search_term_string}` },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: SITE.name,
      url: SITE.url,
      logo: `${SITE.url}/icons/icon-512.png`,
      email: SITE.supportEmail,
      areaServed: COUNTRIES.map((c) => c.name),
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd).replace(/</g, "\\u003c") }} />
      {/* Hero */}
      {/* Sits above the sections below so the search dropdowns can overlap them */}
      <section className="container-page relative z-20 pt-3 sm:pt-5">
        <div className="relative isolate rounded-3xl bg-ocean-900">
          <Image src="/images/hero.jpg" alt="" fill priority sizes="100vw" className="-z-10 rounded-3xl object-cover object-[70%_center]" />
          <div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-b from-ocean-950/60 to-ocean-950/70 sm:bg-gradient-to-r sm:from-ocean-950/85 sm:via-ocean-950/45 sm:to-transparent" />
          <div className="px-5 py-14 sm:px-12 sm:py-24 lg:px-16 lg:py-28">
            <div className="max-w-3xl">
              <h1 className="font-display max-w-xl text-4xl leading-[1.05] font-semibold text-white sm:text-6xl">Buy and sell across the Pacific</h1>
              <p className="mt-4 max-w-xl text-base text-white/75 sm:text-lg">Cars, homes, jobs and everyday deals from people in your community.</p>
              <div className="mt-8">
                <Suspense>
                  <SearchBar key={searchCountry ?? "all"} size="lg" withCategory withCountry defaultCountry={searchCountry} />
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
        <CategoryTiles country={searchCountry} />
      </section>

      {/* List it today */}
      <section className="container-page mt-12 sm:mt-16">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-coral-500 to-coral-600 p-6 text-white shadow-lg shadow-coral-500/20 sm:p-10">
          <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full bg-white/10" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <h2 className="font-display text-3xl leading-tight font-semibold text-white sm:text-4xl">Have something to sell? List it today.</h2>
              <p className="mt-2 text-white/90 sm:text-lg">Snap a photo, add a price and you&apos;re live in about a minute. Buyers across the Pacific can chat with you straight away.</p>
              <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-white/95">
                <li className="flex items-center gap-1.5"><Tag className="h-4 w-4" /> {freeAds ? `Free for up to ${freeAds} ads` : "Free to post"}</li>
                <li className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> About a minute</li>
                <li className="flex items-center gap-1.5"><MessagesSquare className="h-4 w-4" /> Chat with buyers</li>
              </ul>
              {offerDays > 0 && (
                <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1.5 text-sm font-semibold">
                  <Sparkles className="h-4 w-4" /> New sellers: your first ad is featured free for {offerDays} days
                </p>
              )}
            </div>
            <Link href="/post" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-lg font-semibold text-coral-600 shadow-md transition hover:bg-white/90">
              List an item free <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Featured */}
      {featuredListings.length > 0 && (
        <section className="container-page mt-16 sm:mt-24">
          <SectionTitle title={countryName ? `Featured in ${countryName}` : "Featured"} href={searchHref} />
          <ListingRail listings={featuredListings.slice(0, 4)} favoriteIds={favoriteIds} />
        </section>
      )}

      <section className="container-page mt-16 sm:mt-24">
        <AdBanner slot="home_banner" />
      </section>

      {/* Latest */}
      <section className="container-page mt-16 sm:mt-24">
        <SectionTitle title={countryName ? `Latest in ${countryName}` : "Latest listings"} href={searchHref} />
        {latestListings.length ? (
          <ListingGrid listings={latestListings} favoriteIds={favoriteIds} />
        ) : (
          <div className="card flex flex-col items-center px-6 py-14 text-center">
            <Camera className="h-8 w-8 text-faint" />
            <h3 className="font-display mt-4 text-xl font-semibold">Be one of the first to post{countryName ? ` in ${countryName}` : ""}</h3>
            <p className="mt-1 max-w-sm text-sm text-muted">It takes about a minute and it&apos;s free.</p>
            <Link href="/post" className="btn-accent mt-5">
              Post your first ad
            </Link>
          </div>
        )}
        <div className="mt-10 flex justify-center">
          <Link href={searchHref} className="btn-secondary px-6">
            {countryName ? `Browse all in ${countryName}` : "Browse all listings"}
          </Link>
        </div>
      </section>

      {/* Sell */}
      <section className="container-page mt-20 sm:mt-28">
        <div className="grid gap-10 rounded-3xl bg-subtle p-7 sm:p-12 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:p-14">
          <div>
            <h2 className="font-display text-3xl font-semibold sm:text-4xl">Selling something?</h2>
            <p className="mt-3 max-w-md text-ink-2">Post for free in about a minute. Buyers chat with you in the app, or call and WhatsApp you directly, with no fees on the sale.</p>
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
              ["Buyers get in touch", "They chat with you in the app, or call or WhatsApp you. No middleman."],
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
              <Link key={c.code} href={landingPath(c.code)} className="chip">
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
