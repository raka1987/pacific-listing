import { requireStaff, MOD_ROLES } from "@/lib/auth";
import Link from "next/link";
import { Check, EyeOff, ImageIcon, Search, Sparkles, Trash2, X } from "lucide-react";
import { Pagination } from "@/components/pagination";
import { StatusBadge } from "@/components/status-badge";
import { CATEGORIES, categoryBySlug } from "@/lib/constants";
import { formatPrice, timeAgo } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Listing } from "@/lib/types";
import { adminDeleteListing, adminSetListingStatus, adminToggleFeatured } from "../actions";
import { ActionButton, ConfirmButton } from "../ui";

export const metadata = { title: "Listings" };

const STATUSES = ["all", "pending", "active", "sold", "hidden", "rejected"] as const;
const PER_PAGE = 30;

type Row = Listing & { seller: { id: string; full_name: string } | null };

export default async function AdminListings({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; category?: string; page?: string }>;
}) {
  await requireStaff(MOD_ROLES);
  const { status = "all", q = "", category = "", page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const supabase = await createClient();

  let query = supabase
    .from("listings")
    .select("*, seller:profiles!listings_user_id_fkey(id, full_name)", { count: "exact" })
    .order("created_at", { ascending: status === "pending" });
  if (status !== "all") query = query.eq("status", status);
  if (category) query = query.eq("category", category);
  const term = q.replace(/[%,()*"\\]/g, " ").trim();
  if (term) query = query.ilike("title", `%${term}%`);
  const { data, count } = await query.range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
  const rows = (data ?? []) as Row[];

  const href = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const m = { status, q, category, ...o };
    for (const [k, v] of Object.entries(m)) if (v && !(k === "status" && v === "all")) p.set(k, v);
    return `/admin/listings${p.size ? `?${p}` : ""}`;
  };

  const iconBtn = "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-ink-2 hover:bg-subtle";

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Listings</h1>
          <p className="text-sm text-muted">{(count ?? 0).toLocaleString()} ads</p>
        </div>
        <form className="flex flex-wrap gap-2">
          <input type="hidden" name="status" value={status} />
          <div className="relative">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-faint" />
            <input name="q" defaultValue={q} placeholder="Search titles…" className="input w-56 pl-9" />
          </div>
          <select name="category" defaultValue={category} className="input w-auto">
            <option value="">All categories</option>
            {CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
          <button className="btn-primary">Filter</button>
        </form>
      </div>

      <div className="scrollbar-none mb-4 flex gap-2 overflow-x-auto">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={href({ status: s, page: undefined })}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold capitalize ${
              status === s ? "bg-ink text-canvas" : "bg-surface text-ink-2 ring-1 ring-line"
            }`}
          >
            {s === "pending" ? "Needs review" : s}
          </Link>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="border-b border-line bg-subtle text-left text-xs font-semibold tracking-wide text-muted uppercase">
            <tr>
              <th className="px-4 py-3">Ad</th>
              <th className="px-4 py-3">Seller</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Views</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((l) => (
              <tr key={l.id} className="align-middle">
                <td className="px-4 py-3">
                  <Link href={`/listing/${l.id}`} className="flex items-center gap-3 hover:text-lagoon-700" target="_blank">
                    <span className="h-11 w-14 shrink-0 overflow-hidden rounded-lg bg-subtle">
                      {l.images[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={l.images[0]} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full items-center justify-center text-slate-300"><ImageIcon className="h-4 w-4" /></span>
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block max-w-xs truncate font-medium">{l.title}</span>
                      <span className="text-xs text-muted">{categoryBySlug(l.category)?.name} · {timeAgo(l.created_at)}</span>
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {l.seller ? (
                    <Link href={`/admin/users?q=${encodeURIComponent(l.seller.full_name)}`} className="hover:text-lagoon-700">{l.seller.full_name || "—"}</Link>
                  ) : "—"}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{formatPrice(l.price, l.price_type, l.country)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <StatusBadge status={l.status} />
                    {l.is_featured && <Sparkles className="h-4 w-4 text-coral-500" aria-label="Featured" />}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted">{l.views}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1.5">
                    {l.status !== "active" && l.status !== "sold" && (
                      <form action={adminSetListingStatus.bind(null, l.id, "active")}>
                        <ActionButton className={`${iconBtn} text-emerald-600`} title="Approve / make live"><Check className="h-4 w-4" /></ActionButton>
                      </form>
                    )}
                    {l.status === "pending" && (
                      <form action={adminSetListingStatus.bind(null, l.id, "rejected")} className="flex items-center gap-1">
                        <input name="reason" placeholder="Reason" className="h-8 w-28 rounded-lg border border-line px-2 text-xs" />
                        <ActionButton className={`${iconBtn} text-red-600`} title="Reject"><X className="h-4 w-4" /></ActionButton>
                      </form>
                    )}
                    {l.status === "active" && (
                      <form action={adminSetListingStatus.bind(null, l.id, "hidden")}>
                        <ActionButton className={iconBtn} title="Hide from site"><EyeOff className="h-4 w-4" /></ActionButton>
                      </form>
                    )}
                    <form action={adminToggleFeatured.bind(null, l.id, !l.is_featured)}>
                      <ActionButton className={`${iconBtn} ${l.is_featured ? "border-coral-200 bg-coral-500/10 text-coral-600" : ""}`} title={l.is_featured ? "Remove from featured" : "Feature on homepage"}>
                        <Sparkles className="h-4 w-4" />
                      </ActionButton>
                    </form>
                    <form action={adminDeleteListing.bind(null, l.id)}>
                      <ConfirmButton message={`Delete "${l.title}" permanently?`} className={`${iconBtn} text-red-600 hover:bg-red-50`}>
                        <Trash2 className="h-4 w-4" />
                      </ConfirmButton>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="p-8 text-center text-sm text-muted">No listings match.</p>}
      </div>
      <Pagination page={page} totalPages={Math.ceil((count ?? 0) / PER_PAGE)} makeHref={(p) => href({ page: String(p) })} />
    </div>
  );
}
