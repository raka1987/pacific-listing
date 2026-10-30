import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Activity log" };

const LABELS: Record<string, string> = {
  "listing.active": "approved an ad",
  "listing.rejected": "rejected an ad",
  "listing.hidden": "hid an ad",
  "listing.feature": "featured an ad",
  "listing.unfeature": "unfeatured an ad",
  "listing.delete": "deleted an ad",
  "user.ban": "banned a user",
  "user.unban": "unbanned a user",
  "user.role": "changed a user's role",
  "user.verify": "changed a verified tick",
  "user.limit": "changed an ad limit",
  "user.business": "gave a business account",
  "user.business_end": "ended a business account",
  "report.resolved": "resolved a report",
  "report.dismissed": "dismissed a report",
  "report.open": "reopened a report",
  "message.delete": "deleted a message",
  "notice.create": "posted a notice",
  "notice.delete": "deleted a notice",
  "settings.update": "changed site settings",
  "order.paid": "confirmed a payment",
  "order.cancelled": "cancelled an order",
  "order.refunded": "marked an order refunded",
  "pricing.package": "changed promotion prices",
  "pricing.fee": "changed a posting fee",
  "pricing.plan": "changed a business plan",
  "pricing.ad_slot": "changed banner prices",
  "campaign.create": "created a banner campaign",
  "campaign.update": "edited a banner campaign",
  "campaign.invoice": "invoiced a banner campaign",
  "campaign.active": "started a banner campaign",
  "campaign.paused": "paused a banner campaign",
  "campaign.ended": "ended a banner campaign",
  "campaign.delete": "deleted a banner campaign",
};

function targetHref(type: string | null, id: string | null) {
  if (!id) return null;
  if (type === "listing") return `/listing/${id}`;
  if (type === "user") return `/admin/users/${id}`;
  if (type === "campaign") return `/admin/ads/${id}`;
  if (type === "order") return `/admin/payments?status=all`;
  return null;
}

export default async function ActivityPage() {
  await requireStaff(["admin"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_log")
    .select("id, action, target_type, target_id, details, created_at, actor:profiles!audit_log_actor_id_fkey(full_name)")
    .order("created_at", { ascending: false })
    .limit(300);
  const rows = (data ?? []) as unknown as {
    id: number;
    action: string;
    target_type: string | null;
    target_id: string | null;
    details: Record<string, unknown> | null;
    created_at: string;
    actor: { full_name: string } | null;
  }[];

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-2xl font-semibold">Activity log</h1>
      <p className="mb-5 text-sm text-muted">Every change made by staff, newest first.</p>
      {rows.length ? (
        <ol className="card divide-y divide-line">
          {rows.map((r) => {
            const href = targetHref(r.target_type, r.target_id);
            const detail = r.details && (r.details.title || r.details.name || r.details.reason || r.details.business_name);
            return (
              <li key={r.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-5 py-3 text-sm">
                <span className="font-semibold text-ink">{r.actor?.full_name ?? "Someone"}</span>
                <span className="text-ink-2">{LABELS[r.action] ?? r.action}</span>
                {detail ? <span className="text-ink-2">· {String(detail)}</span> : null}
                {href && (
                  <Link href={href} className="font-medium text-lagoon-700 hover:underline">
                    view
                  </Link>
                )}
                <span className="ml-auto text-xs text-muted tabular-nums">
                  {formatDate(r.created_at)} {new Date(r.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="card p-8 text-center text-sm text-muted">Nothing yet. Changes made in the admin panel will appear here.</p>
      )}
    </div>
  );
}
