import Link from "next/link";
import { ArrowRight, Clock, Flag, List, Mail, TrendingUp, Users } from "lucide-react";
import { CATEGORIES } from "@/lib/constants";
import { formatPrice, timeAgo } from "@/lib/format";
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

export default async function AdminDashboard() {
  const supabase = await createClient();
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

  const cards = [
    { label: "Live ads", value: s.listings_active, sub: `+${s.listings_7d} this week`, icon: List, href: "/admin/listings?status=active" },
    { label: "Users", value: s.users, sub: `+${s.users_7d} this week`, icon: Users, href: "/admin/users" },
    { label: "Awaiting review", value: s.listings_pending, sub: "Pending ads", icon: Clock, href: "/admin/listings?status=pending", alert: s.listings_pending > 0 },
    { label: "Open reports", value: s.reports_open, sub: `${s.messages_new} new messages`, icon: Flag, href: "/admin/reports", alert: s.reports_open > 0 },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-slate-900">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {cards.map(({ label, value, sub, icon: Icon, href, alert }) => (
          <Link key={label} href={href} className="card p-5 transition hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">{label}</span>
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${alert ? "bg-coral-500/10 text-coral-600" : "bg-lagoon-50 text-lagoon-700"}`}>
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 text-3xl font-extrabold text-slate-900">{value.toLocaleString()}</p>
            <p className="mt-0.5 text-xs text-slate-500">{sub}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section className="card p-5">
          <h2 className="flex items-center gap-2 font-bold text-slate-900">
            <TrendingUp className="h-4 w-4 text-lagoon-600" /> New ads, last 14 days
          </h2>
          <div className="mt-6 flex h-44 items-end gap-1.5">
            {s.by_day.map((d) => (
              <div key={d.day} className="group flex flex-1 flex-col items-center gap-1.5">
                <span className="text-[10px] font-semibold text-slate-500 opacity-0 group-hover:opacity-100">{d.n}</span>
                <div
                  className="w-full rounded-t-md bg-lagoon-500 transition group-hover:bg-lagoon-600"
                  style={{ height: `${Math.max(3, (d.n / maxDay) * 140)}px` }}
                  title={`${d.day}: ${d.n}`}
                />
                <span className="text-[10px] text-slate-400">{new Date(d.day).getDate()}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="card p-5">
          <h2 className="font-bold text-slate-900">Live ads by category</h2>
          <ul className="mt-4 space-y-2.5">
            {CATEGORIES.map((c) => {
              const n = s.by_category[c.slug] ?? 0;
              return (
                <li key={c.slug} className="text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">{c.name}</span>
                    <span className="font-semibold text-slate-900">{n}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-lagoon-500" style={{ width: `${(n / maxCat) * 100}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Waiting for review" href="/admin/listings?status=pending" empty="No ads waiting — all caught up.">
          {(pending ?? []).map((l) => (
            <li key={l.id}>
              <Link href={`/listing/${l.id}`} className="flex items-center gap-3 py-2.5 hover:text-lagoon-700">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {l.images[0] ? <img src={l.images[0]} alt="" className="h-10 w-12 rounded-lg object-cover" /> : <span className="h-10 w-12 rounded-lg bg-slate-100" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{l.title}</span>
                  <span className="text-xs text-slate-500">{formatPrice(l.price, l.price_type, l.country)} · {timeAgo(l.created_at)}</span>
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
                  <span className="text-xs text-slate-500">{r.reason} · {timeAgo(r.created_at)}</span>
                </span>
              </li>
            );
          })}
        </Panel>
      </div>
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
        <h2 className="font-bold text-slate-900">{title}</h2>
        <Link href={href} className="text-sm font-semibold text-lagoon-700 hover:underline">View all</Link>
      </div>
      {children.length ? <ul className="mt-2 divide-y divide-slate-100">{children}</ul> : <p className="mt-4 text-sm text-slate-500">{empty}</p>}
    </section>
  );
}
