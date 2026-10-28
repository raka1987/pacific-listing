import type { ListingStatus } from "@/lib/types";

const STYLES: Record<ListingStatus, string> = {
  active: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  sold: "bg-subtle text-ink-2",
  hidden: "bg-subtle text-muted",
  rejected: "bg-red-100 text-red-700",
};

const LABELS: Record<ListingStatus, string> = {
  active: "Live",
  pending: "In review",
  sold: "Sold",
  hidden: "Hidden",
  rejected: "Rejected",
};

export function StatusBadge({ status }: { status: ListingStatus }) {
  return <span className={`badge ${STYLES[status]}`}>{LABELS[status]}</span>;
}
