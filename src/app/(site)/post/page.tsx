import type { Metadata } from "next";
import { createListing } from "@/app/actions";
import { ListingForm } from "@/components/listing-form";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { isBusiness } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Prices } from "@/lib/types";

export const metadata: Metadata = { title: "Post a free ad", robots: { index: false } };

export default async function PostPage() {
  const { user, profile } = await requireUser("/post");
  if (profile?.is_banned) {
    return (
      <div className="container-page max-w-3xl py-10">
        <PageHeader title="Account suspended" description="Your account can't post new ads. Contact support if you think this is a mistake." />
      </div>
    );
  }
  const supabase = await createClient();
  const { data: feeRows } = await supabase.from("category_fees").select("category, prices").eq("is_active", true);
  let fees: Record<string, Prices> = Object.fromEntries((feeRows ?? []).map((r) => [r.category, r.prices as Prices]));
  if (isBusiness(profile?.business_until) && profile?.plan_id) {
    const { data: plan } = await supabase.from("plans").select("waive_posting_fees").eq("id", profile.plan_id).maybeSingle();
    if (plan?.waive_posting_fees) fees = {};
  }
  return (
    <div className="container-page max-w-3xl py-8">
      <PageHeader title="Post a free ad" description="It only takes a minute. Fill in the details below." />
      <ListingForm
        action={createListing}
        userId={user.id}
        defaults={{
          country: profile?.country ?? null,
          city: profile?.city ?? null,
          phone: profile?.phone ?? null,
          whatsapp: profile?.whatsapp ?? null,
        }}
        fees={fees}
      />
    </div>
  );
}
