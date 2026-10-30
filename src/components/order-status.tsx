import type { OrderStatus } from "@/lib/types";

const STYLES: Record<OrderStatus, string> = {
  awaiting_payment: "bg-amber-100 text-amber-700",
  paid: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-subtle text-muted",
  refunded: "bg-violet-100 text-violet-700",
};
const LABELS: Record<OrderStatus, string> = {
  awaiting_payment: "Awaiting payment",
  paid: "Paid",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`badge ${STYLES[status]}`}>{LABELS[status]}</span>;
}
