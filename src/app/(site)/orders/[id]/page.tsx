import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Receipt } from "lucide-react";
import { OrderStatusBadge } from "@/components/order-status";
import { PrintButton } from "@/components/print-button";
import { requireUser } from "@/lib/auth";
import { ORDER_KINDS, PAYMENT_METHODS, SITE } from "@/lib/constants";
import { formatDate, formatMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Order, PaymentDetails } from "@/lib/types";
import { PayOrder } from "./pay";

export const metadata: Metadata = { title: "Payment", robots: { index: false } };

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const { id } = await params;
  const { new: isNew } = await searchParams;
  const { user, profile } = await requireUser(`/orders/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const [{ data: order }, { data: settings }] = await Promise.all([
    supabase.from("orders").select("*").eq("id", id).maybeSingle<Order>(),
    supabase.from("site_settings").select("payment_details, card_payments_enabled").eq("id", 1).single(),
  ]);
  if (!order) notFound();
  const amount = formatMoney(order.amount, order.currency);
  const owner = order.user_id === user.id;

  return (
    <div className="container-page max-w-3xl py-8">
      <Link href="/orders" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink print:hidden">
        <ArrowLeft className="h-4 w-4" /> Payments
      </Link>

      {isNew && order.kind === "posting_fee" && order.status === "awaiting_payment" && (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Your ad is saved and ready to go</p>
          <p>This category has a small posting fee. Your ad goes live as soon as the payment is confirmed.</p>
        </div>
      )}

      <div className="card mb-6 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted">
              {order.status === "paid" ? "Receipt" : "Order"} {order.order_number}
            </p>
            <h1 className="font-display mt-1 text-2xl font-bold sm:text-3xl">{order.description}</h1>
            <p className="mt-1 text-sm text-muted">
              {ORDER_KINDS[order.kind]} · {formatDate(order.created_at)}
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-3xl font-bold text-ink">{amount}</p>
            <div className="mt-1">
              <OrderStatusBadge status={order.status} />
            </div>
          </div>
        </div>
        {order.status === "paid" && (
          <div className="mt-5 grid gap-3 border-t border-line pt-5 text-sm sm:grid-cols-3">
            <Info label="Paid on" value={order.paid_at ? formatDate(order.paid_at) : "—"} />
            <Info label="Method" value={order.method ? PAYMENT_METHODS[order.method] : "—"} />
            <Info label="Billed to" value={order.billing_name || profile?.full_name || "—"} />
            <div className="flex items-center justify-between gap-3 sm:col-span-3">
              <p className="text-xs text-muted">{SITE.name} · {SITE.supportEmail}</p>
              <PrintButton />
            </div>
          </div>
        )}
        {order.status === "awaiting_payment" && order.payer_reference && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl bg-lagoon-50 p-4 text-sm text-lagoon-900">
            <Clock className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              We&apos;ve received your payment details ({order.method ? PAYMENT_METHODS[order.method] : ""} · {order.payer_reference}) and will confirm
              shortly. Your purchase switches on as soon as it&apos;s confirmed.
            </p>
          </div>
        )}
      </div>

      {order.status === "awaiting_payment" && !order.payer_reference && owner && (
        <PayOrder
          orderId={order.id}
          orderNumber={order.order_number}
          amountLabel={amount}
          initialMethod={order.method === "mycash" || order.method === "bank" || order.method === "card" ? order.method : "mpaisa"}
          details={(settings?.payment_details ?? {}) as PaymentDetails}
          cardEnabled={!!settings?.card_payments_enabled}
          canCancel={order.kind !== "posting_fee"}
        />
      )}
      {order.status === "cancelled" && (
        <p className="card flex items-center gap-3 p-5 text-muted">
          <Receipt className="h-5 w-5" /> This order was cancelled. Nothing was charged.
        </p>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium tracking-wide text-faint uppercase">{label}</p>
      <p className="mt-0.5 font-semibold text-ink">{value}</p>
    </div>
  );
}
