import Link from "next/link";
import { Globe2, ImageIcon, Plus } from "lucide-react";
import { countryByCode } from "@/lib/constants";
import { SubmitButton } from "@/components/submit-button";
import { requireStaff, SALES_ROLES } from "@/lib/auth";
import { formatDate, formatMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { AdSlot, Campaign } from "@/lib/types";
import { adminSaveSlot } from "../actions";
import { PriceGrid } from "../price-grid";
import { CampaignStatus } from "./campaign-status";

export const metadata = { title: "Banner ads" };

export default async function AdminAds() {
  await requireStaff(SALES_ROLES);
  const supabase = await createClient();
  const [{ data: c }, { data: s }] = await Promise.all([
    supabase.from("ad_campaigns").select("*").order("created_at", { ascending: false }),
    supabase.from("ad_slots").select("*").order("sort"),
  ]);
  const campaigns = (c ?? []) as Campaign[];
  const slots = (s ?? []) as AdSlot[];
  const slotName = new Map(slots.map((x) => [x.code, x.name]));

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Banner ads</h1>
          <p className="text-sm text-muted">Banners you&apos;ve sold to businesses, with views and clicks to show them.</p>
        </div>
        <Link href="/admin/ads/new" className="btn-primary">
          <Plus className="h-4 w-4" /> New campaign
        </Link>
      </div>

      <section>
        {campaigns.length ? (
          <div className="card overflow-x-auto">
            <table className="rtable w-full min-w-[880px] text-sm">
              <thead className="border-b border-line bg-subtle text-left text-xs font-semibold tracking-wide text-muted uppercase">
                <tr>
                  <th className="px-4 py-3">Campaign</th>
                  <th className="px-4 py-3">Spot</th>
                  <th className="px-4 py-3">Shown in</th>
                  <th className="px-4 py-3">Dates</th>
                  <th className="px-4 py-3 text-right">Views</th>
                  <th className="px-4 py-3 text-right">Clicks</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {campaigns.map((x) => (
                  <tr key={x.id}>
                    <td className="px-4 py-3">
                      <Link href={`/admin/ads/${x.id}`} className="flex items-center gap-3 hover:text-lagoon-700">
                        <span className="flex h-10 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-subtle text-faint">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {x.image_url ? <img src={x.image_url} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-4 w-4" />}
                        </span>
                        <span>
                          <span className="block font-semibold text-ink">{x.title}</span>
                          <span className="text-xs text-muted">{x.advertiser_name}</span>
                        </span>
                      </Link>
                    </td>
                    <td data-label="Spot" className="px-4 py-3 text-ink-2">{slotName.get(x.slot_code)}</td>
                    <td data-label="Shown in" className="px-4 py-3">
                      {x.countries.length ? (
                        <span className="text-ink-2">{x.countries.map((c) => countryByCode(c)?.flag ?? c).join(" ")}</span>
                      ) : (
                        <span className="badge bg-violet-100 text-violet-700">
                          <Globe2 className="h-3 w-3" /> Global
                        </span>
                      )}
                    </td>
                    <td data-label="Dates" className="px-4 py-3 whitespace-nowrap text-ink-2">
                      {formatDate(x.starts_on)} – {formatDate(x.ends_on)}
                    </td>
                    <td data-label="Views" className="px-4 py-3 text-right text-ink-2 tabular-nums">{x.impressions.toLocaleString()}</td>
                    <td data-label="Clicks" className="px-4 py-3 text-right text-ink-2 tabular-nums">
                      {x.clicks.toLocaleString()}
                      {x.impressions > 0 && <span className="ml-1 text-xs text-muted">({((x.clicks / x.impressions) * 100).toFixed(1)}%)</span>}
                    </td>
                    <td data-label="Price" className="px-4 py-3 text-right font-semibold whitespace-nowrap text-ink tabular-nums">{formatMoney(x.amount, x.currency)}</td>
                    <td data-label="Status" className="px-4 py-3">
                      <CampaignStatus campaign={x} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card p-10 text-center text-sm text-muted">No campaigns yet. Create one when an advertiser books a spot.</div>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold">Rate card</h2>
        <p className="mb-3 text-sm text-muted">
          Weekly prices for each spot: one price for a single country, and a higher price for a global campaign shown in every country. These show on the public &quot;Advertise
          with us&quot; page and fill in new campaigns.
        </p>
        <div className="card divide-y divide-line">
          {slots.map((x) => (
            <form key={x.code} action={adminSaveSlot.bind(null, x.code)} className="grid gap-4 p-5 lg:grid-cols-[220px_1fr_auto] lg:items-start">
              <div>
                <p className="font-semibold text-ink">{x.name}</p>
                <p className="text-xs text-muted">{x.size_hint}</p>
                <label className="mt-2 flex items-center gap-2 text-sm text-ink-2">
                  <input type="checkbox" name="is_active" defaultChecked={x.is_active} className="h-4 w-4 accent-lagoon-600" /> Available
                </label>
                <label className="mt-1.5 flex items-center gap-2 text-sm text-ink-2">
                  <input type="checkbox" name="show_price" defaultChecked={x.show_price !== false} className="h-4 w-4 accent-lagoon-600" /> Show prices on the website
                </label>
                {x.show_price === false && <p className="mt-1 text-xs text-muted">Shows &quot;Price on request&quot; publicly.</p>}
              </div>
              <div className="space-y-4">
                <div>
                  <p className="mb-1 text-xs font-semibold text-ink">One country, per week</p>
                  <PriceGrid prices={x.prices} compact />
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold text-ink">All countries (global), per week</p>
                  <PriceGrid prices={x.global_prices} prefix="global_" compact />
                </div>
              </div>
              <SubmitButton className="btn-secondary" pendingText="Saving…">Save</SubmitButton>
            </form>
          ))}
        </div>
      </section>
    </div>
  );
}
