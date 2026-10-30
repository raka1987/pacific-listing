import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, Globe2, LayoutTemplate, MousePointerClick, Target } from "lucide-react";
import { ContentPage } from "@/components/content-page";
import { formatMoney, priceIn } from "@/lib/format";
import { getViewer } from "@/lib/location";
import { createClient } from "@/lib/supabase/server";
import type { AdSlot } from "@/lib/types";

export const metadata: Metadata = {
  title: "Advertise with us",
  description: "Put your business in front of buyers across the Pacific with banner advertising on Pacific Listing.",
};

// A small wireframe showing where each ad spot sits on the page.
function SlotDiagram({ code }: { code: string }) {
  const hi = "bg-coral-500";
  const lo = "bg-line";
  return (
    <div className="aspect-[4/3] rounded-2xl border border-line bg-subtle p-3" aria-hidden>
      <div className="mb-2 h-2 w-1/3 rounded-full bg-line" />
      {code === "listing_sidebar" ? (
        <div className="grid h-[85%] grid-cols-[2fr_1fr] gap-2">
          <div className="rounded-lg bg-line" />
          <div className="grid grid-rows-[1fr_1fr] gap-2">
            <div className="rounded-lg bg-line" />
            <div className={`rounded-lg ${hi}`} />
          </div>
        </div>
      ) : (
        <div className="grid h-[85%] grid-rows-[auto_1fr] gap-2">
          <div className={`rounded-lg ${code === "home_banner" ? "h-6 " + lo : "h-4 " + hi}`} />
          <div className="grid grid-cols-4 gap-1.5">
            {Array.from({ length: 8 }).map((_, i) =>
              code === "home_banner" && i === 4 ? null : <div key={i} className="rounded-md bg-line" />,
            )}
            {code === "home_banner" && <div className={`col-span-4 row-start-2 h-5 rounded-md ${hi}`} />}
          </div>
        </div>
      )}
    </div>
  );
}

export default async function AdvertisePage() {
  const supabase = await createClient();
  const { data } = await supabase.from("ad_slots").select("*").eq("is_active", true).order("sort");
  const slots = (data ?? []) as AdSlot[];
  const viewer = await getViewer();
  const currency = slots.every((s) => priceIn(s.prices, viewer.currency) != null) ? viewer.currency : "FJD";
  return (
    <ContentPage title="Advertise with Pacific Listing" intro="Put your business in front of people who are ready to buy, across Fiji, Samoa, Tonga, Vanuatu and the wider Pacific.">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: Globe2, title: "Local or global", text: "Show only in the islands you serve, or across every country for travel, airline and big-brand campaigns." },
          { icon: Target, title: "Target by category", text: "Car dealers appear in Vehicles, agents in Property, and so on." },
          { icon: BarChart3, title: "See your results", text: "We report how many times your banner was seen and clicked." },
        ].map(({ icon: Icon, title, text }) => (
          <div key={title} className="card p-5">
            <Icon className="h-5 w-5 text-lagoon-600" />
            <h2 className="mt-3 font-bold">{title}</h2>
            <p className="mt-1 text-sm text-muted">{text}</p>
          </div>
        ))}
      </div>

      <h2 className="font-display mt-12 mb-5 text-2xl font-bold">Ad spots and prices</h2>
      <div className="grid gap-5 md:grid-cols-3">
        {slots.map((s) => (
          <div key={s.code} className="card flex flex-col p-5">
            <SlotDiagram code={s.code} />
            <h3 className="mt-4 font-bold">{s.name}</h3>
            <p className="mt-1 flex-1 text-sm text-muted">{s.description}</p>
            <p className="mt-4 text-xs font-medium text-faint">
              <LayoutTemplate className="mr-1 inline h-3.5 w-3.5" />
              Image size {s.size_hint}
            </p>
            <dl className="mt-3 divide-y divide-line rounded-2xl border border-line text-sm">
              <div className="flex items-baseline justify-between gap-2 px-3.5 py-2.5">
                <dt className="text-muted">One country</dt>
                <dd>
                  <span className="font-display text-lg font-bold text-ink">{formatMoney(priceIn(s.prices, currency), currency)}</span>
                  <span className="text-muted"> / week</span>
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-2 px-3.5 py-2.5">
                <dt className="text-muted">All countries</dt>
                <dd>
                  <span className="font-display text-lg font-bold text-ink">{formatMoney(priceIn(s.global_prices, currency), currency)}</span>
                  <span className="text-muted"> / week</span>
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted">
        Prices in {currency}. A country banner is only shown to visitors in that country; a global banner is shown to everyone. Discounts for longer bookings on request.
      </p>

      <div className="mt-12 flex flex-col items-start gap-4 rounded-3xl bg-ocean-900 p-7 text-white sm:flex-row sm:items-center sm:justify-between sm:p-9">
        <div>
          <h2 className="font-display text-2xl font-bold text-white">Ready to book a spot?</h2>
          <p className="mt-1 text-white/75">Tell us about your business and we&apos;ll send a quote, usually within a day.</p>
        </div>
        <Link href="/contact?subject=Advertising%20%26%20business" className="btn-accent shrink-0 px-6 py-3">
          <MousePointerClick className="h-4 w-4" /> Get a quote
        </Link>
      </div>
      <p className="mt-6 text-sm text-muted">
        Selling regularly? A <Link href="/business" className="font-semibold text-lagoon-700 hover:underline">Business account</Link> gives you more ads, free bumps and a business badge.
      </p>
    </ContentPage>
  );
}
