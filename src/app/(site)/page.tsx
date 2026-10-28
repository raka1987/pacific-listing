import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, BadgeCheck, Bell, Camera, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { ListingGrid } from "@/components/listing-card";
import { SearchBar } from "@/components/search-bar";
import { CATEGORIES, COUNTRIES } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { getFavoriteIds } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { LISTING_CARD_COLUMNS, type ListingCardData, type Notice } from "@/lib/types";

export const revalidate = 60;

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [featured, latest, notices, counts, favoriteIds] = await Promise.all([
    supabase
      .from("listings")
      .select(LISTING_CARD_COLUMNS)
      .eq("status", "active")
      .eq("is_featured", true)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase.from("listings").select(LISTING_CARD_COLUMNS).eq("status", "active").order("created_at", { ascending: false }).limit(12),
    supabase.from("notices").select("*").eq("is_published", true).order("created_at", { ascending: false }).limit(3),
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("status", "active"),
    getFavoriteIds(supabase, user?.id),
  ]);

  const featuredListings = (featured.data ?? []) as ListingCardData[];
  const latestListings = (latest.data ?? []) as ListingCardData[];
  const noticeList = (notices.data ?? []) as Notice[];
  const liveCount = counts.count ?? 0;

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-ocean-900">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(52,194,182,0.35),transparent_45%),radial-gradient(circle_at_85%_30%,rgba(255,138,107,0.25),transparent_40%)]"
        />
        <svg aria-hidden className="absolute bottom-0 left-0 w-full text-sand-50" viewBox="0 0 1440 80" preserveAspectRatio="none">
          <path fill="currentColor" d="M0 48c120 18 240 28 360 18S600 20 720 18s240 20 360 30 240 8 360-6v40H0z" />
        </svg>
        <div className="container-page relative pt-14 pb-24 sm:pt-20 sm:pb-28">
          <div className="max-w-3xl">
            <span className="badge bg-white/10 text-lagoon-100 ring-1 ring-white/15">
              <Sparkles className="h-3.5 w-3.5" /> Free to post · Across {COUNTRIES.length} Pacific nations
            </span>
            <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Buy, sell &amp; discover <span className="text-lagoon-300">across the Pacific</span>
            </h1>
            <p className="mt-4 max-w-xl text-lg text-slate-300">
              Cars, homes, jobs, services and everyday deals from people in your island community.
            </p>
            <div className="mt-8 max-w-2xl">
              <Suspense>
                <SearchBar size="lg" withCountry />
              </Suspense>
            </div>
            <div className="mt-5 flex flex-wrap gap-2 text-sm">
              <span className="text-slate-400">Popular:</span>
              {["Toyota", "House for rent", "iPhone", "Boat", "Jobs in Suva"].map((t) => (
                <Link
                  key={t}
                  href={`/search?q=${encodeURIComponent(t)}`}
                  className="rounded-full bg-white/10 px-3 py-1 text-slate-200 transition hover:bg-white/20"
                >
                  {t}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="container-page -mt-8 relative">
        <div className="card p-4 sm:p-6">
          <div className="grid grid-cols-5 gap-x-2 gap-y-5 sm:gap-4 lg:grid-cols-10">
            {CATEGORIES.map((c) => (
              <Link key={c.slug} href={`/category/${c.slug}`} className="group flex flex-col items-center gap-2 text-center">
                <span
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl transition group-hover:-translate-y-0.5 group-hover:shadow-md sm:h-14 sm:w-14 ${c.color}`}
                >
                  <CategoryIcon icon={c.icon} className="h-6 w-6" />
                </span>
                <span className="text-[11px] leading-tight font-semibold text-slate-700 sm:text-xs">{c.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured */}
      {featuredListings.length > 0 && (
        <section className="container-page mt-14">
          <SectionTitle title="Featured listings" href="/search" />
          <ListingGrid listings={featuredListings.slice(0, 4)} favoriteIds={favoriteIds} />
        </section>
      )}

      {/* Latest */}
      <section className="container-page mt-14">
        <SectionTitle title="Fresh recommendations" subtitle={liveCount ? `${liveCount.toLocaleString()} live ads` : undefined} href="/search" />
        {latestListings.length ? (
          <ListingGrid listings={latestListings} favoriteIds={favoriteIds} />
        ) : (
          <div className="card flex flex-col items-center px-6 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-coral-400/15 text-coral-600">
              <Camera className="h-7 w-7" />
            </span>
            <h3 className="mt-4 text-lg font-bold text-slate-900">Be one of the first to post</h3>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              It takes about a minute and it&apos;s free. Snap a photo, set a price and reach buyers across the islands.
            </p>
            <Link href="/post" className="btn-accent mt-5">
              Post your first ad
            </Link>
          </div>
        )}
      </section>

      {/* How it works + Sell CTA */}
      <section className="container-page mt-16 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="card p-6 sm:p-8">
          <h2 className="text-xl font-extrabold text-ocean-900">How Pacific Listing works</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-3">
            {[
              { icon: Camera, title: "Post in a minute", text: "Add photos, a price and your location. Posting is free." },
              { icon: MessageCircle, title: "Chat directly", text: "Buyers call or WhatsApp you — no middleman, no fees." },
              { icon: ShieldCheck, title: "Meet safely", text: "Meet in public, inspect first, and never pay upfront." },
            ].map(({ icon: Icon, title, text }, i) => (
              <div key={title}>
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-lagoon-50 text-lagoon-700">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-3 font-bold text-slate-900">
                  <span className="text-lagoon-600">{i + 1}.</span> {title}
                </h3>
                <p className="mt-1 text-sm text-slate-500">{text}</p>
              </div>
            ))}
          </div>
          <Link href="/safety" className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-lagoon-700 hover:underline">
            Read our safety tips <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-coral-500 to-coral-600 p-6 text-white sm:p-8">
          <div aria-hidden className="absolute -right-10 -bottom-10 h-48 w-48 rounded-full bg-white/10" />
          <h2 className="text-2xl font-extrabold">Got something to sell?</h2>
          <p className="mt-2 max-w-xs text-white/85">Turn what you don&apos;t need into cash and reach buyers right across the islands.</p>
          <ul className="mt-5 space-y-2 text-sm">
            {["100% free to post", "Up to 8 photos per ad", "Reach buyers across the Pacific"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <BadgeCheck className="h-4 w-4" /> {t}
              </li>
            ))}
          </ul>
          <Link href="/post" className="btn relative mt-6 bg-white text-coral-600 hover:bg-coral-50">
            Start selling <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Notice board */}
      {noticeList.length > 0 && (
        <section className="container-page mt-14">
          <SectionTitle title="Community notice board" href="/notices" />
          <div className="grid gap-4 md:grid-cols-3">
            {noticeList.map((n) => (
              <Link key={n.id} href={`/notices#${n.id}`} className="card flex gap-3 p-5 transition hover:shadow-md">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <Bell className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900">{n.title}</h3>
                  <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">{n.body}</p>
                  <p className="mt-2 text-xs text-slate-400">{formatDate(n.created_at)}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Browse by country */}
      <section className="container-page mt-14">
        <SectionTitle title="Browse by country" />
        <div className="flex flex-wrap gap-2">
          {COUNTRIES.map((c) => (
            <Link
              key={c.code}
              href={`/search?country=${c.code}`}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-lagoon-300 hover:bg-lagoon-50"
            >
              <span className="mr-1.5">{c.flag}</span>
              {c.name}
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

function SectionTitle({ title, subtitle, href }: { title: string; subtitle?: string; href?: string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-xl font-extrabold tracking-tight text-ocean-900 sm:text-2xl">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {href && (
        <Link href={href} className="flex shrink-0 items-center gap-1 text-sm font-semibold text-lagoon-700 hover:underline">
          See all <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}
