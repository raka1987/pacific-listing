import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Receipt } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { OrderStatusBadge } from "@/components/order-status";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { ORDER_KINDS } from "@/lib/constants";
import { formatDate, formatMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Order } from "@/lib/types";

export const metadata: Metadata = { title: "Payments", robots: { index: false } };

export default async function OrdersPage() {
  const { user } = await requireUser("/orders");
  const supabase = await createClient();
  const { data } = await supabase.from("orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
  const orders = (data ?? []) as Order[];
  return (
    <div className="container-page max-w-3xl py-8">
      <PageHeader title="Payments" description="Promotions, business plans and fees you've bought, with receipts." />
      {orders.length ? (
        <ul className="card divide-y divide-line overflow-hidden">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/orders/${o.id}`} className="flex items-center gap-4 p-4 transition hover:bg-subtle">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-subtle text-ink-2">
                  <Receipt className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">{o.description}</span>
                  <span className="text-sm text-muted">
                    {o.order_number} · {ORDER_KINDS[o.kind]} · {formatDate(o.created_at)}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block font-semibold text-ink">{o.amount === 0 ? "Free" : formatMoney(o.amount, o.currency)}</span>
                  <OrderStatusBadge status={o.status} />
                </span>
                <ChevronRight className="h-5 w-5 text-faint" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={Receipt}
          title="No payments yet"
          description="Promote an ad from My ads to get more views, or upgrade to a Business account."
          action={<Link href="/my-ads" className="btn-primary">Go to My ads</Link>}
        />
      )}
    </div>
  );
}
