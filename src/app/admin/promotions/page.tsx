import Link from "next/link";
import { Sparkles, TrendingUp, Zap } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { requireStaff, SALES_ROLES } from "@/lib/auth";
import { CATEGORIES } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { BoostPackage, Prices } from "@/lib/types";
import { adminSaveFee, adminSavePackage } from "../actions";
import { PriceGrid } from "../price-grid";

export const metadata = { title: "Promotions & fees" };

const KIND = {
  featured: { icon: Sparkles, label: "Featured", tone: "bg-coral-400/15 text-coral-600" },
  bump: { icon: TrendingUp, label: "Bump", tone: "bg-sky-100 text-sky-700" },
  urgent: { icon: Zap, label: "Urgent", tone: "bg-red-100 text-red-700" },
};

export default async function AdminPromotions() {
  await requireStaff(SALES_ROLES);
  const supabase = await createClient();
  const [{ data: pk }, { data: fees }, { data: promoted }] = await Promise.all([
    supabase.from("boost_packages").select("*").order("sort"),
    supabase.from("category_fees").select("*"),
    supabase
      .from("listings")
      .select("id, title, is_featured, featured_until, is_urgent, urgent_until")
      .eq("status", "active")
      .or("is_featured.eq.true,is_urgent.eq.true")
      .order("featured_until", { ascending: true, nullsFirst: false })
      .limit(50),
  ]);
  const packages = (pk ?? []) as BoostPackage[];
  const feeMap = new Map((fees ?? []).map((f) => [f.category as string, f as { prices: Prices; is_active: boolean }]));

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-2xl font-bold">Promotions & fees</h1>
        <p className="text-sm text-muted">What sellers can buy for their ads, and which categories cost money to post in. Leave a price empty to not sell it in that currency.</p>
      </div>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold">Promotions sellers can buy</h2>
        <div className="grid gap-4 xl:grid-cols-2">
          {packages.map((p) => {
            const k = KIND[p.kind];
            return (
              <form key={p.id} action={adminSavePackage.bind(null, p.id)} className="card space-y-4 p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className={`badge ${k.tone}`}>
                    <k.icon className="h-3 w-3" /> {k.label}
                  </span>
                  <label className="flex items-center gap-2 text-sm font-medium text-ink-2">
                    <input type="checkbox" name="is_active" defaultChecked={p.is_active} className="h-4 w-4 accent-lagoon-600" /> On sale
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                  <div>
                    <label className="label" htmlFor={`n-${p.id}`}>Name</label>
                    <input id={`n-${p.id}`} name="name" defaultValue={p.name} className="input" />
                  </div>
                  <div>
                    <label className="label" htmlFor={`d-${p.id}`}>Days</label>
                    <input
                      id={`d-${p.id}`}
                      name="duration_days"
                      type="number"
                      min={1}
                      defaultValue={p.duration_days ?? ""}
                      disabled={p.kind === "bump"}
                      placeholder={p.kind === "bump" ? "Instant" : ""}
                      className="input"
                    />
                  </div>
                </div>
                <div>
                  <label className="label" htmlFor={`ds-${p.id}`}>What the seller sees</label>
                  <input id={`ds-${p.id}`} name="description" defaultValue={p.description} className="input" />
                </div>
                <div>
                  <span className="label">Price</span>
                  <PriceGrid prices={p.prices} />
                </div>
                <div className="flex justify-end">
                  <SubmitButton pendingText="Saving…">Save</SubmitButton>
                </div>
              </form>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg font-bold">Posting fees</h2>
        <p className="mb-3 text-sm text-muted">Charge to post in a category. Ads wait as &quot;Awaiting payment&quot; until paid. Business plans can waive these.</p>
        <div className="card divide-y divide-line">
          {CATEGORIES.map((c) => {
            const f = feeMap.get(c.slug);
            return (
              <form key={c.slug} action={adminSaveFee.bind(null, c.slug)} className="grid gap-4 p-5 lg:grid-cols-[200px_1fr_auto] lg:items-start">
                <div>
                  <p className="font-semibold text-ink">{c.name}</p>
                  <label className="mt-2 flex items-center gap-2 text-sm text-ink-2">
                    <input type="checkbox" name="is_active" defaultChecked={!!f?.is_active} className="h-4 w-4 accent-lagoon-600" /> Charge a fee
                  </label>
                </div>
                <PriceGrid prices={f?.prices ?? {}} compact />
                <SubmitButton className="btn-secondary" pendingText="Saving…">Save</SubmitButton>
              </form>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold">Ads being promoted now</h2>
        {promoted?.length ? (
          <div className="card divide-y divide-line">
            {promoted.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                <Link href={`/listing/${l.id}`} target="_blank" className="font-medium text-ink hover:text-lagoon-700">{l.title}</Link>
                <span className="flex flex-wrap gap-1.5">
                  {l.is_featured && (
                    <span className="badge bg-coral-400/15 text-coral-600">
                      Featured {l.featured_until ? `until ${formatDate(l.featured_until)}` : "(set by staff)"}
                    </span>
                  )}
                  {l.is_urgent && <span className="badge bg-red-100 text-red-700">Urgent until {l.urgent_until ? formatDate(l.urgent_until) : "—"}</span>}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="card p-6 text-sm text-muted">No ads are promoted right now.</p>
        )}
        <p className="mt-2 text-xs text-muted">Promotions end on their own when their time is up.</p>
      </section>
    </div>
  );
}
