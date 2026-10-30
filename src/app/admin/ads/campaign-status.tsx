import type { Campaign } from "@/lib/types";

const STYLE: Record<Campaign["status"], [string, string]> = {
  draft: ["Draft", "bg-subtle text-muted"],
  awaiting_payment: ["Awaiting payment", "bg-amber-100 text-amber-700"],
  active: ["Running", "bg-emerald-100 text-emerald-700"],
  paused: ["Paused", "bg-sky-100 text-sky-700"],
  ended: ["Ended", "bg-subtle text-muted"],
};

export function CampaignStatus({ campaign }: { campaign: Pick<Campaign, "status" | "starts_on" | "ends_on"> }) {
  const today = new Date().toISOString().slice(0, 10);
  let [label, cls] = STYLE[campaign.status];
  if (campaign.status === "active" && campaign.starts_on > today) [label, cls] = ["Scheduled", "bg-violet-100 text-violet-700"];
  return <span className={`badge ${cls}`}>{label}</span>;
}
