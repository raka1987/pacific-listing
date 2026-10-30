import Link from "next/link";
import { Check, ExternalLink, RotateCcw, X } from "lucide-react";
import { OrderStatusBadge } from "@/components/order-status";
import { requireStaff, SALES_ROLES } from "@/lib/auth";
import { ORDER_KINDS, PAYMENT_METHODS } from "@/lib/constants";
import { formatDate, formatMoney, timeAgo } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Order } from "@/lib/types";
import { adminMarkPaid, adminSetOrderStatus } from "../actions";
import { ActionButton, ConfirmButton } from "../ui";

export const metadata = { title: "Payments" };

type Row = Order & { customer: { id: string; full_name: string } | null };

const TABS = [
  ["to_check", "To confirm"],
  ["awaiting_payment", "Unpaid"],
  ["paid", "Paid"],
  ["cancelled", "Cancelled"],
  ["refunded", "Refunded"],
  ["all", "All"],
] as const;

export default async function AdminPayments({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  await requireStaff(SALES_ROLES);
  const { status = "to_check", q = "" } = await searchParams;
  const supabase = await createClient();
  let query = supabase
    .from("orders")
    .select("*, customer:profiles!orders_user_id_fkey(id, full_name)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status === "to_check") query = query.eq("status", "awaiting_payment").not("payer_reference", "is", null);
  else if (status !== "all") query = query.eq("status", status);
  const term = q.replace(/[%,()*"\\]/g, " ").trim();
  if (term) query = query.or(`order_number.ilike.%${term}%,description.ilike.%${term}%,payer_reference.ilike.%${term}%,billing_name.ilike.%${term}%`);
  const { data } = await query;
  const orders = (data ?? []) as Row[];
  const btn = "inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink-2 hover:bg-subtle";

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Payments</h1>
          <p className="text-sm text-muted">Confirm M-PAiSA, MyCash and bank transfers here. Confirming a payment switches on what was bought straight away.</p>
        </div>
        <form>
          <input type="hidden" name="status" value={status} />
          <input name="q" defaultValue={q} placeholder="Order no., name or reference…" className="input w-64" />
        </form>
      </div>
      <div className="scrollbar-none mb-4 flex gap-2 overflow-x-auto">
        {TABS.map(([s, l]) => (
          <Link
            key={s}
            href={`/admin/payments?status=${s}`}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold ${status === s ? "bg-ink text-canvas" : "bg-surface text-ink-2 ring-1 ring-line"}`}
          >
            {l}
          </Link>
        ))}
      </div>

      {orders.length ? (
        <div className="card overflow-x-auto">
          <table className="rtable w-full min-w-[960px] text-sm">
            <thead className="border-b border-line bg-subtle text-left text-xs font-semibold tracking-wide text-muted uppercase">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">For</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Paid with</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {orders.map((o) => (
                <tr key={o.id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-ink">{o.order_number}</p>
                    <p className="text-xs text-muted">{timeAgo(o.created_at)}</p>
                  </td>
                  <td data-label="Customer" className="px-4 py-3">
                    {o.customer ? (
                      <Link href={`/admin/users/${o.customer.id}`} className="font-medium text-ink hover:text-lagoon-700">{o.billing_name || o.customer.full_name}</Link>
                    ) : (
                      <span className="font-medium text-ink">{o.billing_name || "—"}</span>
                    )}
                    {o.billing_email && <p className="text-xs text-muted">{o.billing_email}</p>}
                  </td>
                  <td data-label="For" className="max-w-xs px-4 py-3">
                    <p className="truncate text-ink">{o.description}</p>
                    <p className="text-xs text-muted">
                      {ORDER_KINDS[o.kind]}
                      {o.listing_id && (
                        <>
                          {" · "}
                          <Link href={`/listing/${o.listing_id}`} target="_blank" className="inline-flex items-center gap-0.5 hover:text-ink">
                            View ad <ExternalLink className="h-3 w-3" />
                          </Link>
                        </>
                      )}
                      {o.campaign_id && (
                        <>
                          {" · "}
                          <Link href={`/admin/ads/${o.campaign_id}`} className="hover:text-ink">View campaign</Link>
                        </>
                      )}
                    </p>
                  </td>
                  <td data-label="Amount" className="px-4 py-3 text-right font-semibold whitespace-nowrap text-ink tabular-nums">{o.amount === 0 ? "Free" : formatMoney(o.amount, o.currency)}</td>
                  <td data-label="Paid with" className="px-4 py-3">
                    <p className="text-ink">{o.method ? PAYMENT_METHODS[o.method] : "—"}</p>
                    {o.payer_reference && <p className="font-mono text-xs text-ink-2">{o.payer_reference}</p>}
                  </td>
                  <td data-label="Status" className="px-4 py-3">
                    <OrderStatusBadge status={o.status} />
                    {o.paid_at && <p className="mt-1 text-xs text-muted">{formatDate(o.paid_at)}</p>}
                    {o.admin_note && <p className="mt-1 text-xs text-muted">Note: {o.admin_note}</p>}
                  </td>
                  <td className="rtable-actions px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {o.status === "awaiting_payment" && (
                        <form action={adminMarkPaid.bind(null, o.id)} className="flex items-center gap-1">
                          <input name="note" placeholder="Note (optional)" className="h-8 w-32 rounded-lg border border-line bg-surface px-2 text-xs text-ink" />
                          <ConfirmButton message={`Confirm you've received ${formatMoney(o.amount, o.currency)} for ${o.order_number}?`} className={`${btn} border-emerald-200 text-emerald-700 hover:bg-emerald-50`}>
                            <Check className="h-3.5 w-3.5" /> Mark paid
                          </ConfirmButton>
                        </form>
                      )}
                      {o.status === "awaiting_payment" && (
                        <form action={adminSetOrderStatus.bind(null, o.id, "cancelled")}>
                          <ActionButton className={btn}>
                            <X className="h-3.5 w-3.5" /> Cancel
                          </ActionButton>
                        </form>
                      )}
                      {o.status === "paid" && o.amount > 0 && (
                        <form action={adminSetOrderStatus.bind(null, o.id, "refunded")}>
                          <ConfirmButton message="Mark this order as refunded? Send the money back first; this only records it." className={btn}>
                            <RotateCcw className="h-3.5 w-3.5" /> Refunded
                          </ConfirmButton>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card p-10 text-center text-sm text-muted">
          {status === "to_check" ? "No payments waiting to be confirmed. You're all caught up." : "No payments here."}
        </div>
      )}
    </div>
  );
}
