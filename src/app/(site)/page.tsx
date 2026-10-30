import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, ArrowUpRight, Bell, Camera, MessageCircle, ShieldCheck, Sparkles, Zap } from "lucide-react";
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

  const [featured, latest, notices, categoryRows, favoriteIds] = await Promise.all([
    supabase
      .from("listings")
      .select(LISTING_CARD_COLUMNS)
      .eq("status", "active")
      .eq("is_featured", true)
      .order("sort_at", { ascending: false })
      .limit(8),
    supabase.from("listings").select(LISTING_CARD_COLUMNS).eq("status", "active").order("sort_at", { ascending: false }).limit(12),
    supabase.from("notices").select("*").eq("is_published", true).order("created_at", { ascending: false }).limit(3),
    supabase.from("listings").select("category").eq("status", "active").limit(5000),
    getFavoriteIds(supabase, user?.id),
  ]);

  const viewer = await getViewer();
  const featuredListings = (featured.data ?? []) as ListingCardData[];
  const latestListings = (latest.data ?? []) as ListingCardData[];
  const noticeList = (notices.data ?? []) as Notice[];
  const counts: Record<string, number> = {};
  for (const r of categoryRows.data ?? []) counts[r.category] = (counts[r.category] ?? 0) + 1;
  const liveCount = (categoryRows.data ?? []).length;

  return (
    <>
      {/* Hero */}
      <section className="container-page pt-3 sm:pt-6">
        <div className="relative isolate overflow-hidden rounded-[2rem] bg-ocean-900 sm:rounded-[2.5rem]">
          <Image src="/images/hero.jpg" alt="" fill priority sizes="100vw" className="-z-10 object-cover object-[70%_center]" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-ocean-950/70 via-ocean-950/40 to-ocean-950/80 sm:bg-gradient-to-r sm:from-ocean-950/90 sm:via-ocean-950/55 sm:to-transparent" />
          <div className="px-5 pt-14 pb-8 sm:px-12 sm:pt-24 sm:pb-14 lg:px-16 lg:pt-28">
            <div className="max-w-2xl">
              <span className="animate-fade-up badge bg-white/15 py-1 pr-3 pl-2 text-white ring-1 ring-white/25 backdrop-blur">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-coral-500">
                  <Sparkles className="h-3 w-3" />
                </span>
                Free to post in {COUNTRIES.length} Pacific nations
              </span>
              <h1
                className="animate-fade-up font-display mt-5 text-[2.6rem] leading-[1.02] font-extrabold text-white sm:text-6xl lg:text-7xl"
                style={{ animationDelay: "80ms" }}
              >
                The island marketplace,{" "}
                <span className="bg-gradient-to-r from-[#a0ede2] to-[#34c2b6] bg-clip-text text-transparent">reimagined.</span>
              </h1>
              <p className="animate-fade-up mt-4 max-w-lg text-base text-white/80 sm:text-lg" style={{ animationDelay: "160ms" }}>
                Cars, homes, jobs, services and everyday deals from people in your community.
              </p>
              <div className="animate-fade-up mt-8" style={{ animationDelay: "240ms" }}>
                <Suspense>
                  <SearchBar size="lg" withCountry defaultCountry={viewer.pacificCountry} />
                </Suspense>
              </div>
              <div className="animate-fade-up scrollbar-none -mx-5 mt-4 flex gap-2 overflow-x-auto px-5 text-sm sm:mx-0 sm:flex-wrap sm:px-0" style={{ animationDelay: "320ms" }}>
                {["Toyota", "House for rent", "iPhone", "Boat", "Jobs in Suva"].map((t) => (
                  <Link
                    key={t}
                    href={`/search?q=${encodeURIComponent(t)}`}
                    className="shrink-0 rounded-full bg-white/10 px-3.5 py-1.5 text-white/90 ring-1 ring-white/15 backdrop-blur transition hover:bg-white/20"
                  >
                    {t}
                  </Link>
                ))}
              </div>
            </div>
            <div className="mt-16 hidden flex-wrap gap-3 sm:flex">
              {[
                { icon: Zap, value: liveCount.toLocaleString(), label: "live ads" },
                { icon: MessageCircle, value: "Direct", label: "WhatsApp & call" },
                { icon: ShieldCheck, value: "Moderated", label: "safer trading" },
              ].map(({ icon: Icon, value, label }) => (
                <div key={label} className="flex items-center gap-3 rounded-2xl bg-white/10 py-2.5 pr-4 pl-2.5 ring-1 ring-white/15 backdrop-blur-md">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-white">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="leading-tight">
                    <span className="block text-sm font-bold text-white">{value}</span>
                    <span className="text-xs text-white/70">{label}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="container-page mt-12 sm:mt-16">
        <SectionTitle eyebrow="Explore" title="Shop by category" href="/search" />
        <CategoryTiles counts={counts} />
      </section>

      {/* Featured */}
      {featuredListings.length > 0 && (
        <section className="container-page mt-14 sm:mt-20">
          <SectionTitle eyebrow="Hand-picked" title="Featured listings" href="/search" />
          <ListingRail listings={featuredListings.slice(0, 4)} favoriteIds={favoriteIds} />
        </section>
      )}

      <section className="container-page mt-14 sm:mt-20">
        <AdBanner slot="home_banner" />
      </section>

      {/* Latest */}
      <section className="container-page mt-14 sm:mt-20">
        <SectionTitle eyebrow="Just in" title="Fresh recommendations" href="/search" />
        {latestListings.length ? (
          <ListingGrid listings={latestListings} favoriteIds={favoriteIds} />
        ) : (
          <div className="card flex flex-col items-center px-6 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-coral-400/15 text-coral-600">
              <Camera className="h-7 w-7" />
            </span>
            <h3 className="font-display mt-4 text-xl font-bold">Be one of the first to post</h3>
            <p className="mt-1 max-w-sm text-sm text-muted">
              It takes about a minute and it&apos;s free. Snap a photo, set a price and reach buyers across the islands.
            </p>
            <Link href="/post" className="btn-accent mt-5">
              Post your first ad
            </Link>
          </div>
        )}
        <div className="mt-10 flex justify-center">
          <Link href="/search" className="btn-secondary px-6">
            Browse all listings <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Sell CTA */}
      <section className="container-page mt-16 sm:mt-24">
        <div className="relative isolate overflow-hidden rounded-[2rem] bg-ocean-900 sm:rounded-[2.5rem]">
          <Image src="/images/sell-cta.jpg" alt="" fill sizes="100vw" className="-z-10 object-cover" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ocean-950/95 via-ocean-950/75 to-ocean-950/20" />
          <div className="grid gap-10 p-7 sm:p-12 lg:grid-cols-2 lg:p-16">
            <div>
              <p className="text-sm font-semibold tracking-wider text-lagoon-300 uppercase">Got something to sell?</p>
              <h2 className="font-display mt-3 text-3xl font-extrabold text-white sm:text-5xl">Turn clutter into cash in a minute.</h2>
              <p className="mt-4 max-w-md text-white/75">Post for free, add up to 8 photos and get calls and WhatsApp messages from buyers across the islands.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/post" className="btn-accent px-7 py-3.5 text-base">
                  Start selling <ArrowUpRight className="h-4 w-4" />
                </Link>
                <Link href="/safety" className="btn px-6 py-3.5 text-base text-white ring-1 ring-white/30 hover:bg-white/10">
                  Safety tips
                </Link>
              </div>
            </div>
            <ol className="grid gap-3 self-end">
              {[
                { icon: Camera, title: "Snap & post", text: "Add photos, a price and your location." },
                { icon: MessageCircle, title: "Chat directly", text: "Buyers call or WhatsApp you. No fees." },
                { icon: ShieldCheck, title: "Meet safely", text: "Meet in public and inspect before paying." },
              ].map(({ icon: Icon, title, text }, i) => (
                <li key={title} className="flex items-center gap-4 rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur-md">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-ocean-900">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block font-semibold text-white">
                      <span className="text-lagoon-300">0{i + 1}</span> {title}
                    </span>
                    <span className="text-sm text-white/70">{text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Notice board */}
      {noticeList.length > 0 && (
        <section className="container-page mt-16 sm:mt-20">
          <SectionTitle eyebrow="Community" title="Notice board" href="/notices" />
          <div className="grid gap-4 md:grid-cols-3">
            {noticeList.map((n) => (
              <Link key={n.id} href={`/notices#${n.id}`} className="card group flex gap-4 p-5 transition hover:-translate-y-0.5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                  <Bell className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-faint">{formatDate(n.created_at)}</p>
                  <h3 className="mt-0.5 font-bold group-hover:text-lagoon-700">{n.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{n.body}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* App + countries */}
      <section className="container-page mt-16 grid gap-6 sm:mt-20 lg:grid-cols-[1fr_1.4fr]">
        <InstallAppCard />
        <div className="card p-6 sm:p-8">
          <p className="text-sm font-semibold tracking-wider text-lagoon-600 uppercase">Across the Pacific</p>
          <h2 className="font-display mt-2 text-2xl font-bold">Browse by country</h2>
          <div className="mt-5 flex flex-wrap gap-2">
            {COUNTRIES.map((c) => (
              <Link key={c.code} href={`/search?country=${c.code}`} className="chip">
                <span>{c.flag}</span>
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function SectionTitle({ eyebrow, title, href }: { eyebrow?: string; title: string; href?: string }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="text-sm font-semibold tracking-wider text-lagoon-600 uppercase">{eyebrow}</p>}
        <h2 className="font-display mt-1 text-2xl font-bold sm:text-3xl">{title}</h2>
      </div>
      {href && (
        <Link href={href} className="group flex shrink-0 items-center gap-1 text-sm font-semibold text-ink hover:text-lagoon-700">
          See all <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
