import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireStaff, SALES_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AdSlot } from "@/lib/types";
import { CampaignForm } from "../campaign-form";

export const metadata = { title: "New campaign" };

export default async function NewCampaign() {
  const { user } = await requireStaff(SALES_ROLES);
  const supabase = await createClient();
  const { data } = await supabase.from("ad_slots").select("*").order("sort");
  return (
    <div className="max-w-4xl">
      <Link href="/admin/ads" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Banner ads
      </Link>
      <h1 className="mb-5 font-display text-2xl font-bold">New banner campaign</h1>
      <CampaignForm slots={(data ?? []) as AdSlot[]} userId={user.id} />
    </div>
  );
}
