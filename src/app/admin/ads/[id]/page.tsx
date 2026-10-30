import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Eye, FileText, MousePointerClick, Pause, Percent, Play, Square, Trash2 } from "lucide-react";
import { OrderStatusBadge } from "@/components/order-status";
import { requireStaff, SALES_ROLES } from "@/lib/auth";
import { formatDate, formatMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { AdSlot, Campaign, Order } from "@/lib/types";
import { adminDeleteCampaign, adminInvoiceCampaign, adminSetCampaignStatus } from "../../actions";
import { ActionButton, ConfirmButton } from "../../ui";
import { CampaignForm } from "../campaign-form";
import { CampaignStatus } from "../campaign-status";

export const metadata = { title: "Campaign" };

export default async function CampaignPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { user } = await requireStaff(SALES_ROLES);
  const { id } = await params;
  const { saved } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const [{ data: c }, { data: s }, { data: o }] = await Promise.all([
    supabase.from("ad_campaigns").select("*").eq("id", id).maybeSingle<Campaign>(),
    supabase.from("ad_slots").select("*").order("sort"),
    supabase.from("orders").select("*").eq("campaign_id", id).order("created_at", { ascending: false }),
  ]);
  if (!c) notFound();
  const orders = (o ?? []) as Order[];
  const unpaid = orders.some((x) => x.status === "awaiting_payment");
  const btn = "btn-secondary px-3.5 py-2 text-xs";
  const ctr = c.impressions ? ((c.clicks / c.impressions) * 100).toFixed(1) + "%" : "—";

  return (
    <div className="max-w-4xl space-y-6">
      <Link href="/admin/ads" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Banner ads
      </Link>
      {saved && (
        <p className="flex items-center gap-2 rounded-2xl bg-lagoon-50 p-3 text-sm text-lagoon-800">
          <CheckCircle2 className="h-4 w-4" /> Campaign saved.
        </p>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-semibold">{c.title}</h1>
            <CampaignStatus campaign={c} />
          </div>
          <p className="text-sm text-muted">
            {c.advertiser_name} · {formatDate(c.starts_on)} – {formatDate(c.ends_on)} · {formatMoney(c.amount, c.currency)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {c.status === "draft" && c.amount != null && !unpaid && (
            <form action={adminInvoiceCampaign.bind(null, c.id)}>
              <ActionButton className="btn-primary px-3.5 py-2 text-xs">
                <FileText className="h-4 w-4" /> Create invoice
              </ActionButton>
            </form>
          )}
          {(c.status === "draft" || c.status === "awaiting_payment" || c.status === "paused") && (
            <form action={adminSetCampaignStatus.bind(null, c.id, "active")}>
              <ConfirmButton message="Start showing this banner now, without waiting for payment?" className={btn}>
                <Play className="h-4 w-4" /> Start now
              </ConfirmButton>
            </form>
          )}
          {c.status === "active" && (
            <form action={adminSetCampaignStatus.bind(null, c.id, "paused")}>
              <ActionButton className={btn}>
                <Pause className="h-4 w-4" /> Pause
              </ActionButton>
            </form>
          )}
          {(c.status === "active" || c.status === "paused") && (
            <form action={adminSetCampaignStatus.bind(null, c.id, "ended")}>
              <ConfirmButton message="End this campaign now?" className={btn}>
                <Square className="h-4 w-4" /> End
              </ConfirmButton>
            </form>
          )}
          <form action={adminDeleteCampaign.bind(null, c.id)}>
            <ConfirmButton message="Delete this campaign and its stats?" className="btn-danger px-3.5 py-2 text-xs">
              <Trash2 className="h-4 w-4" />
            </ConfirmButton>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Eye, label: "Views", value: c.impressions.toLocaleString() },
          { icon: MousePointerClick, label: "Clicks", value: c.clicks.toLocaleString() },
          { icon: Percent, label: "Click rate", value: ctr },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="card p-4">
            <p className="flex items-center gap-1.5 text-sm text-muted">
              <Icon className="h-4 w-4" /> {label}
            </p>
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {orders.length > 0 && (
        <section className="card p-5">
          <h2 className="mb-3 font-bold">Invoices</h2>
          <ul className="divide-y divide-line text-sm">
            {orders.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="font-medium text-ink">{x.order_number}</span>
                <span className="text-ink-2">{formatMoney(x.amount, x.currency)}</span>
                <OrderStatusBadge status={x.status} />
                {x.status === "awaiting_payment" && (
                  <Link href="/admin/payments?status=awaiting_payment" className="text-xs font-semibold text-lagoon-700 hover:underline">
                    Mark paid in Payments →
                  </Link>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">The banner starts automatically on its start date once the invoice is marked paid.</p>
        </section>
      )}

      <CampaignForm campaign={c} slots={(s ?? []) as AdSlot[]} userId={user.id} />
    </div>
  );
}
