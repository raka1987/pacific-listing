import Link from "next/link";
import { ArrowRight, BarChart3, Clock, CreditCard, Flag, List, Mail, Megaphone, Store, TrendingUp, Users, Wallet } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { ORDER_KINDS } from "@/lib/constants";
import { CATEGORIES } from "@/lib/constants";
import { formatMoney, formatPrice, timeAgo } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type Stats = {
  users: number;
  users_7d: number;
  listings_active: number;
  listings_pending: number;
  listings_7d: number;
  listings_sold: number;
  reports_open: number;
  messages_new: number;
  by_category: Record<string, number>;
  by_day: { day: string; n: number }[];
};

type Revenue = {
  this_month: Record<string, number>;
  last_month: Record<string, number>;
  by_kind: Record<string, number>;
  by_month: { month: string; total: number }[];
  awaiting: number;
  awaiting_with_reference: number;
  campaigns_active: number;
  businesses: number;
  promoted: number;
};

export default async function AdminDashboard() {
  const { profile } = await requireStaff();
  const supabase = await createClient();
  const canSales = profile.role === "admin" || profile.role === "sales";
  const canMod = profile.role === "admin" || profile.role === "moderator";
  if (canSales) await supabase.rpc("expire_promotions");
  const [{ data: rev }, { data: sources }, { data: traffic }] = await Promise.all([
    canSales ? supabase.rpc("admin_revenue") : Promise.resolve({ data: null }),
    supabase.rpc("admin_signup_sources"),
    supabase.rpc("admin_traffic", { p_days: 7 }),
  ]);
  const visits = traffic as { today: { visitors: number }; period: { visitors: number } } | null;
  const r = rev as Revenue | null;
  const [{ data: stats }, { data: pending }, { data: reports }] = await Promise.all([
    supabase.rpc("admin_stats"),
    supabase
      .from("listings")
      .select("id, title, price, price_type, country, images, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(5),
    supabase
      .from("reports")
      .select("id, reason, created_at, listing:listings(id, title)")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  const s = stats as Stats;
  const maxDay = Math.max(1, ...s.by_day.map((d) => d.n));
  const maxCat = Math.max(1, ...Object.values(s.by_category));

  const isAdmin = profile.role === "admin";
  // Each card links to a page; only show the ones this person can open.
  const cards = [
    { label: "Visitors today", value: visits?.today.visitors ?? 0, sub: `${(visits?.period.visitors ?? 0).toLocaleString()} visits this week`, icon: BarChart3, href: "/admin/traffic", show: !!visits },
    { label: "Live ads", value: s.listings_active, sub: `+${s.listings_7d} this week`, icon: List, href: canMod ? "/admin/listings?status=active" : "/search", show: true },
    { label: "Users", value: s.users, sub: `+${s.users_7d} this week`, icon: Users, href: isAdmin ? "/admin/users" : "/admin", show: true },
    { label: "Awaiting review", value: s.listings_pending, sub: "Pending ads", icon: Clock, href: "/admin/listings?status=pending", alert: s.listings_pending > 0, show: canMod },
    { label: "Open reports", value: s.reports_open, sub: `${s.messages_new} new messages`, icon: Flag, href: "/admin/reports", alert: s.reports_open > 0, show: canMod },
  ].filter((c) => c.show);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-semibold">Dashboard</h1>

      {r && <RevenuePanel r={r} />}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
        {cards.map(({ label, value, sub, icon: Icon, href, alert }) => (
          <Link key={label} href={href} className="card p-5 transition hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted">{label}</span>
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${alert ? "bg-coral-500/10 text-coral-600" : "bg-lagoon-50 text-lagoon-700"}`}>
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 text-3xl font-semibold text-ink">{value.toLocaleString()}</p>
            <p className="mt-0.5 text-xs text-muted">{sub}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section className="card p-5">
          <h2 className="flex items-center gap-2 font-bold text-ink">
            <TrendingUp className="h-4 w-4 text-lagoon-600" /> New ads, last 14 days
          </h2>
          <div className="mt-6 flex h-44 items-end gap-1.5">
            {s.by_day.map((d) => (
              <div key={d.day} className="group flex flex-1 flex-col items-center gap-1.5">
                <span className="text-[10px] font-semibold text-muted opacity-0 group-hover:opacity-100">{d.n}</span>
                <div
                  className="w-full rounded-t-md bg-lagoon-500 transition group-hover:bg-lagoon-600"
                  style={{ height: `${Math.max(3, (d.n / maxDay) * 140)}px` }}
                  title={`${d.day}: ${d.n}`}
                />
                <span className="text-[10px] text-faint">{new Date(d.day).getDate()}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="card p-5">
          <h2 className="font-bold text-ink">Live ads by category</h2>
          <ul className="mt-4 space-y-2.5">
            {CATEGORIES.map((c) => {
              const n = s.by_category[c.slug] ?? 0;
              return (
                <li key={c.slug} className="text-sm">
                  <div className="flex justify-between">
                    <span className="text-ink-2">{c.name}</span>
                    <span className="font-semibold text-ink">{n}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-subtle">
                    <div className="h-full rounded-full bg-lagoon-500" style={{ width: `${(n / maxCat) * 100}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {sources && <SourcesCard sources={sources as { last_30_days: Record<string, number>; all_time: Record<string, number> }} />}

      {canMod && <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Waiting for review" href="/admin/listings?status=pending" empty="No ads waiting — all caught up.">
          {(pending ?? []).map((l) => (
            <li key={l.id}>
              <Link href={`/listing/${l.id}`} className="flex items-center gap-3 py-2.5 hover:text-lagoon-700">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {l.images[0] ? <img src={l.images[0]} alt="" className="h-10 w-12 rounded-lg object-cover" /> : <span className="h-10 w-12 rounded-lg bg-subtle" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{l.title}</span>
                  <span className="text-xs text-muted">{formatPrice(l.price, l.price_type, l.country)} · {timeAgo(l.created_at)}</span>
                </span>
              </Link>
            </li>
          ))}
        </Panel>
        <Panel title="Latest reports" href="/admin/reports" empty="No open reports.">
          {(reports ?? []).map((r) => {
            const listing = r.listing as unknown as { id: string; title: string } | null;
            return (
              <li key={r.id} className="flex items-center gap-3 py-2.5">
                <Flag className="h-4 w-4 shrink-0 text-red-500" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{listing?.title ?? "Deleted listing"}</span>
                  <span className="text-xs text-muted">{r.reason} · {timeAgo(r.created_at)}</span>
                </span>
              </li>
            );
          })}
        </Panel>
      </div>}
      {s.messages_new > 0 && (
        <Link href="/admin/messages" className="card flex items-center gap-3 p-4 text-sm font-medium hover:shadow-md">
          <Mail className="h-4 w-4 text-lagoon-600" /> You have {s.messages_new} new contact message{s.messages_new > 1 ? "s" : ""}.
          <ArrowRight className="ml-auto h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

function Panel({ title, href, empty, children }: { title: string; href: string; empty: string; children: React.ReactNode[] }) {
  return (
    <section className="card p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-ink">{title}</h2>
        <Link href={href} className="text-sm font-semibold text-lagoon-700 hover:underline">View all</Link>
      </div>
      {children.length ? <ul className="mt-2 divide-y divide-line">{children}</ul> : <p className="mt-4 text-sm text-muted">{empty}</p>}
    </section>
  );
}

function RevenuePanel({ r }: { r: Revenue }) {
  const fjd = r.this_month.FJD ?? 0;
  const last = r.last_month.FJD ?? 0;
  const change = last ? Math.round(((fjd - last) / last) * 100) : null;
  const others = Object.entries(r.this_month).filter(([c]) => c !== "FJD");
  const max = Math.max(1, ...r.by_month.map((m) => Number(m.total)));
  const kinds = Object.entries(r.by_kind).sort((a, b) => b[1] - a[1]);
  const kindMax = Math.max(1, ...kinds.map(([, v]) => v));
  return (
    <section className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium text-muted"><Wallet className="h-4 w-4" /> Revenue this month</p>
            <p className="mt-1 font-display text-4xl font-semibold tabular-nums">{formatMoney(fjd, "FJD")}</p>
            <p className="mt-1 text-sm text-muted">
              {change == null ? "First month with sales" : `${change >= 0 ? "+" : ""}${change}% on last month (${formatMoney(last, "FJD")})`}
            </p>
            {others.length > 0 && <p className="mt-1 text-sm text-ink-2">Plus {others.map(([c, v]) => formatMoney(v, c)).join(" · ")}</p>}
          </div>
          <Link href="/admin/payments" className={`card flex items-center gap-3 p-3 ${r.awaiting_with_reference ? "border-coral-400" : ""}`}>
            <CreditCard className={`h-5 w-5 ${r.awaiting_with_reference ? "text-coral-600" : "text-muted"}`} />
            <span className="text-sm">
              <span className="block font-semibold text-ink">{r.awaiting_with_reference} to confirm</span>
              <span className="text-muted">{r.awaiting} unpaid in total</span>
            </span>
          </Link>
        </div>
        <p className="mt-6 text-xs font-medium text-muted">FJD revenue, last 6 months</p>
        <div className="mt-2 flex h-32 items-end gap-3">
          {r.by_month.map((m) => (
            <div key={m.month} className="group flex flex-1 flex-col items-center gap-1.5">
              <span className="text-[10px] font-semibold text-muted tabular-nums">{Number(m.total) ? formatMoney(Number(m.total), "") .trim() : ""}</span>
              <div className="w-full rounded-t-md bg-coral-500" style={{ height: `${Math.max(3, (Number(m.total) / max) * 96)}px` }} />
              <span className="text-[10px] text-faint">{new Date(m.month + "-01").toLocaleDateString("en-GB", { month: "short" })}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-4">
        <div className="card p-5">
          <p className="text-sm font-medium text-muted">This month by type (FJD)</p>
          {kinds.length ? (
            <ul className="mt-3 space-y-2.5">
              {kinds.map(([k, v]) => (
                <li key={k} className="text-sm">
                  <div className="flex justify-between">
                    <span className="text-ink-2">{ORDER_KINDS[k as keyof typeof ORDER_KINDS] ?? k}</span>
                    <span className="font-semibold text-ink tabular-nums">{formatMoney(v, "FJD")}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-subtle">
                    <div className="h-full rounded-full bg-coral-500" style={{ width: `${(v / kindMax) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">No sales yet this month.</p>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Megaphone, label: "Banners live", value: r.campaigns_active, href: "/admin/ads" },
            { icon: Store, label: "Businesses", value: r.businesses, href: "/admin/business" },
            { icon: TrendingUp, label: "Ads promoted", value: r.promoted, href: "/admin/promotions" },
          ].map(({ icon: Icon, label, value, href }) => (
            <Link key={label} href={href} className="card p-3.5 transition hover:shadow-md">
              <Icon className="h-4 w-4 text-lagoon-600" />
              <p className="mt-2 font-display text-2xl font-semibold tabular-nums">{value}</p>
              <p className="text-xs text-muted">{label}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function SourcesCard({ sources }: { sources: { last_30_days: Record<string, number>; all_time: Record<string, number> } }) {
  const rows = Object.entries(sources.last_30_days).sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((n, [, v]) => n + v, 0);
  const max = Math.max(1, ...rows.map(([, v]) => v));
  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold text-ink">Where new members heard about us</h2>
        <span className="text-xs text-muted">Last 30 days · {total} sign-ups</span>
      </div>
      {rows.length ? (
        <ul className="mt-4 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
          {rows.map(([k, v]) => (
            <li key={k} className="text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-ink-2">{k}</span>
                <span className="font-semibold text-ink tabular-nums">
                  {v} <span className="font-normal text-muted">({Math.round((v / total) * 100)}%)</span>
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-subtle">
                <div className="h-full rounded-full bg-lagoon-500" style={{ width: `${(v / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted">No sign-ups in the last 30 days yet.</p>
      )}
    </section>
  );
}
