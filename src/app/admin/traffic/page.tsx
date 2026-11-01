import Link from "next/link";
import { Eye, Globe2, MonitorSmartphone, MousePointerClick, Users } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Traffic" };

type Traffic = {
  today: { views: number; visitors: number };
  period: { views: number; visitors: number };
  by_day: { day: string; views: number; visitors: number }[];
  pages: { path: string; views: number; visitors: number }[];
  countries: { country: string; visitors: number }[];
  referrers: { referrer: string; visitors: number }[];
  devices: Record<string, number>;
};

const RANGES = [7, 30, 90];
const DEVICES: Record<string, string> = { phone: "Phone browser", computer: "Computer", app: "Phone app" };
const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
const flag = (code: string) => (/^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0))) : "🌐");
const countryName = (code: string) => {
  try {
    return /^[A-Z]{2}$/.test(code) ? (regionNames.of(code) ?? code) : "Unknown";
  } catch {
    return code;
  }
};
const shortDate = (day: string) => new Date(`${day}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const longDate = (day: string) => new Date(`${day}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

export default async function TrafficPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requireStaff();
  const days = RANGES.includes(Number((await searchParams).days)) ? Number((await searchParams).days) : 30;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_traffic", { p_days: days });

  if (error || !data) {
    return (
      <div>
        <h1 className="font-display mb-4 text-2xl font-semibold">Traffic</h1>
        <div className="card p-6 text-sm text-ink-2">
          Couldn&apos;t load the traffic figures{error ? ` (${error.message})` : ""}. Please refresh the page.
        </div>
      </div>
    );
  }
  const t = data as Traffic;

  // Friendly names for ad pages.
  const adIds = t.pages.map((p) => p.path.match(/^\/listing\/([0-9a-f-]{36})$/)?.[1]).filter((id): id is string => !!id);
  const { data: ads } = adIds.length ? await supabase.from("listings").select("id, title").in("id", adIds) : { data: [] };
  const adTitle = new Map((ads ?? []).map((a) => [a.id, a.title as string]));
  const pageLabel = (path: string) => {
    if (path === "/") return "Homepage";
    const ad = path.match(/^\/listing\/([0-9a-f-]{36})$/)?.[1];
    if (ad) return `Ad: ${adTitle.get(ad) ?? "removed ad"}`;
    return path;
  };

  const maxDay = Math.max(1, ...t.by_day.map((d) => d.visitors));
  const deviceTotal = Math.max(1, Object.values(t.devices).reduce((a, b) => a + b, 0));
  const tiles = [
    { label: "Visitors today", value: t.today.visitors, icon: Users },
    { label: "Pages viewed today", value: t.today.views, icon: Eye },
    { label: `Visits, last ${days} days`, value: t.period.visitors, icon: MousePointerClick },
    { label: `Pages viewed, last ${days} days`, value: t.period.views, icon: Eye },
  ];
  const labelEvery = Math.ceil(t.by_day.length / 7);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Traffic</h1>
          <p className="text-sm text-muted">People visiting the website and apps. Days are in Fiji time.</p>
        </div>
        <div className="flex gap-1.5">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/admin/traffic?days=${r}`}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${days === r ? "bg-ink text-canvas" : "bg-surface text-ink-2 ring-1 ring-line"}`}
            >
              {r} days
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {tiles.map(({ label, value, icon: Icon }) => (
          <div key={label} className="card p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-muted">{label}</span>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lagoon-50 text-lagoon-700">
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 text-3xl font-semibold text-ink">{value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <section className="card p-5">
        <h2 className="font-bold text-ink">Visitors per day</h2>
        <p className="text-xs text-muted">Hover or tap a bar to see the numbers.</p>
        <div className="relative mt-5">
          <span className="absolute -top-1 left-0 text-[10px] text-faint">{maxDay.toLocaleString()}</span>
          <div className="absolute inset-x-0 top-1 border-t border-dashed border-line" />
          <div className="flex h-48 items-end gap-0.5 border-b border-line pt-4">
            {t.by_day.map((d) => (
              <div key={d.day} className="group relative flex h-full flex-1 items-end" tabIndex={0}>
                <div
                  className="w-full rounded-t bg-lagoon-500 transition group-hover:bg-lagoon-700 group-focus:bg-lagoon-700"
                  style={{ height: d.visitors ? `${Math.max(3, (d.visitors / maxDay) * 100)}%` : "0" }}
                />
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 rounded-lg bg-ink px-2.5 py-1.5 text-xs whitespace-nowrap text-canvas shadow-lg group-hover:block group-focus:block">
                  <p className="font-semibold">{longDate(d.day)}</p>
                  <p>{d.visitors.toLocaleString()} visitors · {d.views.toLocaleString()} pages</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex gap-0.5">
            {t.by_day.map((d, i) => (
              <span key={d.day} className="flex-1 text-center text-[10px] whitespace-nowrap text-faint">
                {i % labelEvery === 0 || i === t.by_day.length - 1 ? shortDate(d.day) : ""}
              </span>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <ListCard
          title="Most viewed pages"
          icon={Eye}
          head={["Page", "Views"]}
          rows={t.pages.map((p) => ({ key: p.path, label: pageLabel(p.path), href: p.path, value: p.views }))}
          empty="No page views yet."
        />
        <ListCard
          title="Where visitors are"
          icon={Globe2}
          head={["Country", "Visits"]}
          rows={t.countries.map((c) => ({ key: c.country, label: `${flag(c.country)} ${countryName(c.country)}`, value: c.visitors }))}
          empty="No visitors yet."
        />
        <ListCard
          title="Where visitors came from"
          icon={MousePointerClick}
          head={["Website or app", "Visits"]}
          rows={t.referrers.map((r) => ({ key: r.referrer, label: r.referrer, value: r.visitors }))}
          empty="No visits from other websites yet. Visits from Facebook, Google and others will show here; people who type the address or use a bookmark aren't listed."
        />
        <section className="card p-5">
          <h2 className="flex items-center gap-2 font-bold text-ink">
            <MonitorSmartphone className="h-4 w-4 text-lagoon-600" /> Devices
          </h2>
          <ul className="mt-4 space-y-3">
            {Object.entries(DEVICES).map(([key, label]) => {
              const n = t.devices[key] ?? 0;
              return (
                <li key={key} className="text-sm">
                  <div className="flex justify-between">
                    <span className="text-ink-2">{label}</span>
                    <span className="font-semibold text-ink">
                      {n.toLocaleString()} <span className="font-normal text-muted">({Math.round((n / deviceTotal) * 100)}%)</span>
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-subtle">
                    <div className="h-full rounded-full bg-lagoon-500" style={{ width: `${(n / deviceTotal) * 100}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <p className="text-xs text-muted">
        A visitor is counted once per day per phone or computer. No cookies are used, and the website doesn&apos;t store who anyone is.
        Visits over several days add up each day&apos;s visitors. Search engines and link previews aren&apos;t counted.
      </p>
    </div>
  );
}

function ListCard({
  title,
  icon: Icon,
  head,
  rows,
  empty,
}: {
  title: string;
  icon: typeof Eye;
  head: [string, string];
  rows: { key: string; label: string; href?: string; value: number }[];
  empty: string;
}) {
  return (
    <section className="card p-5">
      <h2 className="flex items-center gap-2 font-bold text-ink">
        <Icon className="h-4 w-4 text-lagoon-600" /> {title}
      </h2>
      {rows.length ? (
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-1.5 font-medium">{head[0]}</th>
              <th className="py-1.5 text-right font-medium">{head[1]}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="max-w-0 truncate py-2 pr-3 text-ink-2">
                  {r.href ? (
                    <Link href={r.href} target="_blank" className="hover:text-lagoon-700 hover:underline">{r.label}</Link>
                  ) : (
                    r.label
                  )}
                </td>
                <td className="py-2 text-right font-semibold text-ink tabular-nums">{r.value.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-3 text-sm text-muted">{empty}</p>
      )}
    </section>
  );
}
