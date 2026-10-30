import Link from "next/link";
import { Store } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { requireStaff, SALES_ROLES } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Plan } from "@/lib/types";
import { adminSavePlan } from "../actions";
import { PriceGrid } from "../price-grid";

export const metadata = { title: "Business plans" };

export default async function AdminBusiness() {
  await requireStaff(SALES_ROLES);
  const supabase = await createClient();
  const [{ data: pl }, { data: subs }] = await Promise.all([
    supabase.from("plans").select("*").order("sort"),
    supabase
      .from("profiles")
      .select("id, full_name, business_name, business_until, plan_id, country")
      .not("business_until", "is", null)
      .order("business_until", { ascending: true }),
  ]);
  const plans = (pl ?? []) as Plan[];
  const planName = new Map(plans.map((p) => [p.id, p.name]));
  const now = Date.now();
  const soon = now + 7 * 86400000;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-2xl font-semibold">Business plans</h1>
        <p className="text-sm text-muted">Monthly accounts for regular sellers. Prices and limits here show on the public Business accounts page.</p>
      </div>

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Subscribers</h2>
        {subs?.length ? (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-line bg-subtle text-left text-xs font-semibold tracking-wide text-muted uppercase">
                <tr>
                  <th className="px-4 py-3">Business</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Runs until</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {subs.map((s) => {
                  const until = new Date(s.business_until!).getTime();
                  const state = until < now ? ["Ended", "bg-subtle text-muted"] : until < soon ? ["Renewal due", "bg-amber-100 text-amber-700"] : ["Active", "bg-emerald-100 text-emerald-700"];
                  return (
                    <tr key={s.id}>
                      <td className="px-4 py-3">
                        <Link href={`/admin/users/${s.id}`} className="font-medium text-ink hover:text-lagoon-700">{s.business_name || s.full_name}</Link>
                        <p className="text-xs text-muted">{s.full_name}</p>
                      </td>
                      <td className="px-4 py-3 text-ink-2">{(s.plan_id && planName.get(s.plan_id)) || "—"}</td>
                      <td className="px-4 py-3 text-ink-2">{formatDate(s.business_until!)}</td>
                      <td className="px-4 py-3"><span className={`badge ${state[1]}`}>{state[0]}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="card p-6 text-sm text-muted">No business accounts yet. You can also give one to a user from their page under Users.</p>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Plans</h2>
        <div className="grid gap-4 xl:grid-cols-2">
          {plans.map((p) => (
            <form key={p.id} action={adminSavePlan.bind(null, p.id)} className="card space-y-4 p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-lagoon-100 text-lagoon-700"><Store className="h-5 w-5" /></span>
                <label className="flex items-center gap-2 text-sm font-medium text-ink-2">
                  <input type="checkbox" name="is_active" defaultChecked={p.is_active} className="h-4 w-4 accent-lagoon-600" /> On sale
                </label>
              </div>
              <div>
                <label className="label" htmlFor={`pn-${p.id}`}>Name</label>
                <input id={`pn-${p.id}`} name="name" defaultValue={p.name} className="input" />
              </div>
              <div>
                <label className="label" htmlFor={`pd-${p.id}`}>Short description</label>
                <input id={`pd-${p.id}`} name="description" defaultValue={p.description} className="input" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label" htmlFor={`pdd-${p.id}`}>Days</label>
                  <input id={`pdd-${p.id}`} name="duration_days" type="number" min={1} defaultValue={p.duration_days} className="input" />
                </div>
                <div>
                  <label className="label" htmlFor={`pm-${p.id}`}>Live ads</label>
                  <input id={`pm-${p.id}`} name="max_active_ads" type="number" min={0} defaultValue={p.max_active_ads ?? ""} placeholder="Unlimited" className="input" />
                </div>
                <div>
                  <label className="label" htmlFor={`pb-${p.id}`}>Free bumps</label>
                  <input id={`pb-${p.id}`} name="free_bumps" type="number" min={0} defaultValue={p.free_bumps} className="input" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-ink-2">
                <input type="checkbox" name="waive_posting_fees" defaultChecked={p.waive_posting_fees} className="h-4 w-4 accent-lagoon-600" /> No posting fees on this plan
              </label>
              <div>
                <label className="label" htmlFor={`pf-${p.id}`}>Features (one per line)</label>
                <textarea id={`pf-${p.id}`} name="features" rows={4} defaultValue={p.features.join("\n")} className="input" />
              </div>
              <div>
                <span className="label">Price per period</span>
                <PriceGrid prices={p.prices} />
              </div>
              <div className="flex justify-end">
                <SubmitButton pendingText="Saving…">Save plan</SubmitButton>
              </div>
            </form>
          ))}
        </div>
      </section>
    </div>
  );
}
