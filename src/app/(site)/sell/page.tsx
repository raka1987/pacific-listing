import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Camera, MessageCircle, Sparkles, Store, Wallet } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { CATEGORIES, COUNTRIES, SITE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Sell on Pacific Listing: post a free ad",
  description:
    "Sell your car, house, phone or anything else across the Pacific. Post a free ad in a minute and get calls and WhatsApp messages from local buyers.",
  alternates: { canonical: "/sell" },
};

const QUICK = [
  ["vehicles", "Sell your car"],
  ["property", "Rent out or sell property"],
  ["electronics", "Sell a phone or laptop"],
  ["home-garden", "Sell furniture"],
  ["jobs", "Post a job"],
  ["services", "Advertise a service"],
] as const;

export default async function SellPage() {
  const supabase = await createClient();
  const [{ count }, { data: settings }] = await Promise.all([
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("site_settings").select("*").eq("id", 1).maybeSingle(),
  ]);
  const offerDays = (settings as { launch_offer_days?: number | null } | null)?.launch_offer_days ?? null;

  return (
    <>
      <section className="container-page pt-3 sm:pt-5">
        <div className="relative isolate overflow-hidden rounded-3xl bg-ocean-900">
          <Image src="/images/hero.jpg" alt="" fill priority sizes="100vw" className="-z-10 object-cover object-[70%_center]" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ocean-950/90 via-ocean-950/60 to-ocean-950/10" />
          <div className="max-w-2xl px-5 py-14 sm:px-12 sm:py-20">
            {offerDays && (
              <span className="badge mb-5 bg-coral-500 py-1 text-white">
                <Sparkles className="h-3.5 w-3.5" /> Launch offer: your first ad is featured free for {offerDays} days
              </span>
            )}
            <h1 className="font-display text-4xl leading-[1.05] font-semibold text-white sm:text-5xl">Sell it faster, for free</h1>
            <p className="mt-4 max-w-lg text-lg text-white/80">
              Post your ad in a minute and reach buyers across {COUNTRIES.slice(0, 4).map((c) => c.name).join(", ")} and the wider Pacific. They call or
              WhatsApp you directly, with no fees on the sale.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/post" className="btn-accent px-7 py-3.5 text-base">
                List an item free <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/business" className="btn px-6 py-3.5 text-base text-white ring-1 ring-white/30 hover:bg-white/10">
                For businesses
              </Link>
            </div>
            {(count ?? 0) > 0 && <p className="mt-5 text-sm text-white/60">{count!.toLocaleString()} ads live right now</p>}
          </div>
        </div>
      </section>

      <section className="container-page mt-14">
        <h2 className="font-display text-2xl font-semibold sm:text-3xl">What are you selling?</h2>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {QUICK.map(([slug, label]) => {
            const c = CATEGORIES.find((x) => x.slug === slug)!;
            return (
              <Link key={slug} href={`/post?category=${slug}`} className="card group flex items-center gap-3 p-4 transition hover:border-faint">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${c.color}`}>
                  <CategoryIcon icon={c.icon} className="h-5 w-5" />
                </span>
                <span className="font-medium text-ink">{label}</span>
                <ArrowRight className="ml-auto h-4 w-4 text-faint transition group-hover:translate-x-0.5 group-hover:text-ink" />
              </Link>
            );
          })}
        </div>
      </section>

      <section className="container-page mt-16 grid gap-6 md:grid-cols-3">
        {[
          { icon: Camera, title: "Post in a minute", text: "Snap up to 8 photos with your phone, set a price and your town. That's it." },
          { icon: MessageCircle, title: "Buyers contact you", text: "People call or WhatsApp you directly. You agree the deal your way." },
          { icon: Wallet, title: "Free to post", text: `No listing fee and no commission on most ads. Prices show in your own currency.` },
        ].map(({ icon: Icon, title, text }) => (
          <div key={title} className="card p-6">
            <Icon className="h-6 w-6 text-lagoon-600" />
            <h3 className="mt-4 font-semibold text-ink">{title}</h3>
            <p className="mt-1 text-sm text-muted">{text}</p>
          </div>
        ))}
      </section>

      <section className="container-page mt-16">
        <div className="grid items-center gap-8 rounded-3xl bg-subtle p-7 sm:p-12 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <h2 className="font-display text-2xl font-semibold sm:text-3xl">Selling every week?</h2>
            <p className="mt-3 max-w-lg text-ink-2">
              Car yards, real estate agents, shops and tradespeople get more from a Business account: up to unlimited ads, a business badge, a shop page
              and free bumps every month.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/business" className="btn-primary px-6 py-3">
                <Store className="h-4 w-4" /> See business plans
              </Link>
              <Link href="/contact?subject=Advertising%20%26%20business" className="btn-secondary px-6 py-3">
                Talk to us
              </Link>
            </div>
          </div>
          <ul className="space-y-3 text-sm text-ink-2">
            {["List your whole stock, not just a few items", "Show your logo and business name on every ad", "Bump ads back to the top for free", "Ask us about bulk uploading your stock"].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-lagoon-600" /> {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container-page mt-16 max-w-3xl">
        <h2 className="font-display text-2xl font-semibold">Good to know</h2>
        <dl className="mt-5 divide-y divide-line border-y border-line">
          {[
            ["Is it really free?", "Yes. Posting an ad is free in most categories. You can pay to promote an ad if you want more views, but you never have to."],
            ["Who can see my phone number?", "Only the number you choose to add to your ad. Your email address is never shown."],
            ["How long does my ad stay up?", "Until you mark it as sold or remove it. You can edit it at any time from My ads."],
            ["How do I stay safe?", "Meet in a public place, let buyers check the item first, and never accept odd payment requests. See our safety tips."],
          ].map(([q, a]) => (
            <div key={q} className="py-4">
              <dt className="font-medium text-ink">{q}</dt>
              <dd className="mt-1 text-sm text-muted">{a}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-8 flex justify-center">
          <Link href="/post" className="btn-accent px-8 py-3.5 text-base">
            List an item free
          </Link>
        </div>
        <p className="mt-4 text-center text-xs text-muted">Questions? Email {SITE.supportEmail}</p>
      </section>
    </>
  );
}
