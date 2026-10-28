import type { Metadata } from "next";
import Link from "next/link";
import { Eye, ImageIcon, Megaphone, Plus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { OwnerActions } from "@/components/owner-actions";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { formatPrice, timeAgo } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Listing, ListingStatus } from "@/lib/types";

export const metadata: Metadata = { title: "My ads", robots: { index: false } };

const TABS: { key: string; label: string; statuses: ListingStatus[] }[] = [
  { key: "live", label: "Live", statuses: ["active"] },
  { key: "review", label: "In review", statuses: ["pending", "rejected"] },
  { key: "sold", label: "Sold", statuses: ["sold"] },
  { key: "hidden", label: "Hidden", statuses: ["hidden"] },
];

export default async function MyAdsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { user } = await requireUser("/my-ads");
  const { tab = "all" } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("listings").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
  const all = (data ?? []) as Listing[];
  const current = TABS.find((t) => t.key === tab);
  const listings = current ? all.filter((l) => current.statuses.includes(l.status)) : all;

  return (
    <div className="container-page max-w-5xl py-8">
      <PageHeader
        title="My ads"
        description="Manage everything you've posted."
        action={
          <Link href="/post" className="btn-accent">
            <Plus className="h-4 w-4" /> Post an ad
          </Link>
        }
      />
      <div className="scrollbar-none mb-5 flex gap-2 overflow-x-auto">
        {[{ key: "all", label: "All", statuses: [] as ListingStatus[] }, ...TABS].map((t) => {
          const n = t.key === "all" ? all.length : all.filter((l) => t.statuses.includes(l.status)).length;
          return (
            <Link
              key={t.key}
              href={t.key === "all" ? "/my-ads" : `/my-ads?tab=${t.key}`}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${
                tab === t.key ? "bg-ink text-canvas" : "bg-surface text-ink-2 ring-1 ring-line hover:bg-subtle"
              }`}
            >
              {t.label} <span className="ml-1 opacity-60">{n}</span>
            </Link>
          );
        })}
      </div>

      {listings.length ? (
        <ul className="space-y-3">
          {listings.map((l) => (
            <li key={l.id} className="card flex flex-col gap-4 p-3 sm:flex-row sm:items-center">
              <Link href={`/listing/${l.id}`} className="flex min-w-0 flex-1 items-center gap-4">
                <div className="h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-subtle">
                  {l.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.images[0]} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-slate-300"><ImageIcon className="h-6 w-6" /></div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={l.status} />
                    {l.is_featured && <span className="badge bg-coral-500 text-white">Featured</span>}
                  </div>
                  <p className="mt-1 truncate font-semibold text-ink">{l.title}</p>
                  <p className="text-sm text-muted">
                    {formatPrice(l.price, l.price_type, l.country)} · {timeAgo(l.created_at)} ·{" "}
                    <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {l.views}</span>
                  </p>
                  {l.status === "rejected" && l.rejection_reason && (
                    <p className="mt-1 text-sm text-red-600">Reason: {l.rejection_reason}</p>
                  )}
                </div>
              </Link>
              <OwnerActions id={l.id} status={l.status} compact />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={Megaphone}
          title={all.length ? "Nothing here" : "You haven't posted anything yet"}
          description={all.length ? "No ads in this group." : "Post your first ad for free — it only takes a minute."}
          action={!all.length && <Link href="/post" className="btn-accent">Post an ad</Link>}
        />
      )}
    </div>
  );
}
