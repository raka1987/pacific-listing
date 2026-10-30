import { requireStaff, MOD_ROLES } from "@/lib/auth";
import Link from "next/link";
import { Check, EyeOff, Flag, Trash2, X } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { timeAgo } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { ListingStatus } from "@/lib/types";
import { adminDeleteListing, adminHideReportedListing, adminSetReportStatus } from "../actions";
import { ActionButton, ConfirmButton } from "../ui";

export const metadata = { title: "Reports" };

type Report = {
  id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  listing: { id: string; title: string; status: ListingStatus; images: string[] } | null;
  reporter: { full_name: string } | null;
};

export default async function AdminReports({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireStaff(MOD_ROLES);
  const { status = "open" } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("reports")
    .select("id, reason, details, status, created_at, listing:listings(id, title, status, images), reporter:profiles(full_name)")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(100);
  const reports = (data ?? []) as unknown as Report[];
  const btn = "inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink-2 hover:bg-subtle";

  return (
    <div>
      <h1 className="mb-5 text-2xl font-extrabold text-ink">Reported ads</h1>
      <div className="mb-4 flex gap-2">
        {["open", "resolved", "dismissed"].map((s) => (
          <Link
            key={s}
            href={`/admin/reports?status=${s}`}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold capitalize ${status === s ? "bg-ink text-canvas" : "bg-surface text-ink-2 ring-1 ring-line"}`}
          >
            {s}
          </Link>
        ))}
      </div>
      {reports.length ? (
        <ul className="space-y-3">
          {reports.map((r) => (
            <li key={r.id} className="card flex flex-col gap-4 p-4 md:flex-row md:items-center">
              <div className="flex min-w-0 flex-1 gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                  <Flag className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{r.reason}</p>
                  {r.details && <p className="mt-0.5 text-sm text-ink-2">“{r.details}”</p>}
                  <p className="mt-1 text-xs text-muted">
                    {r.listing ? (
                      <Link href={`/listing/${r.listing.id}`} target="_blank" className="font-medium text-lagoon-700 hover:underline">{r.listing.title}</Link>
                    ) : (
                      "Listing deleted"
                    )}
                    {r.listing && <> · <StatusBadge status={r.listing.status} /></>} · by {r.reporter?.full_name || "anonymous"} · {timeAgo(r.created_at)}
                  </p>
                </div>
              </div>
              {status === "open" && (
                <div className="flex flex-wrap gap-1.5">
                  {r.listing && r.listing.status === "active" && (
                    <form action={adminHideReportedListing.bind(null, r.listing.id)}>
                      <ActionButton className={btn}><EyeOff className="h-3.5 w-3.5" /> Hide ad</ActionButton>
                    </form>
                  )}
                  {r.listing && (
                    <form action={adminDeleteListing.bind(null, r.listing.id)}>
                      <ConfirmButton message="Delete this ad permanently?" className={`${btn} text-red-600`}><Trash2 className="h-3.5 w-3.5" /> Delete ad</ConfirmButton>
                    </form>
                  )}
                  <form action={adminSetReportStatus.bind(null, r.id, "resolved")}>
                    <ActionButton className={btn}><Check className="h-3.5 w-3.5" /> Resolved</ActionButton>
                  </form>
                  <form action={adminSetReportStatus.bind(null, r.id, "dismissed")}>
                    <ActionButton className={btn}><X className="h-3.5 w-3.5" /> Dismiss</ActionButton>
                  </form>
                </div>
              )}
              {status !== "open" && (
                <form action={adminSetReportStatus.bind(null, r.id, "open")}>
                  <ActionButton className={btn}>Reopen</ActionButton>
                </form>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="card p-10 text-center text-sm text-muted">No {status} reports.</div>
      )}
    </div>
  );
}
