import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Clock, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { VerifyForm } from "./form";

export const metadata: Metadata = { title: "Get verified", robots: { index: false } };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const { user, profile } = await requireUser("/verify");
  const { sent } = await searchParams;
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("verification_requests")
    .select("status, reason, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="container-page max-w-2xl py-8">
      <PageHeader title="Get verified" description="A verified tick shows buyers you're a real, checked person or business." />
      {profile?.is_verified ? (
        <div className="card flex items-start gap-3 p-5">
          <BadgeCheck className="h-6 w-6 shrink-0 text-lagoon-600" />
          <div>
            <p className="font-semibold text-ink">You&apos;re verified</p>
            <p className="text-sm text-muted">The tick shows on your ads, your seller page and in chats.</p>
            <Link href={`/seller/${user.id}`} className="mt-3 inline-block text-sm font-semibold text-lagoon-700 hover:underline">See your seller page</Link>
          </div>
        </div>
      ) : last?.status === "pending" ? (
        <div className="card flex items-start gap-3 p-5">
          <Clock className="h-6 w-6 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold text-ink">{sent ? "Thanks, we've got your request" : "Your request is being checked"}</p>
            <p className="text-sm text-muted">
              Sent {formatDate(last.created_at)}. We usually check within 1–2 working days and will email you when it&apos;s done.
            </p>
          </div>
        </div>
      ) : (
        <>
          {last?.status === "rejected" && (
            <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              <strong>Your last request wasn&apos;t approved.</strong> {last.reason || "We couldn't check the details you sent."} You can try again
              below.
            </p>
          )}
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            {[
              ["More trust", "Buyers are more likely to contact verified sellers."],
              ["Fewer scams", "A checked ID keeps fake sellers off the site."],
              ["Free", "Verification doesn't cost anything."],
            ].map(([t, d]) => (
              <div key={t} className="rounded-2xl bg-subtle p-4">
                <p className="flex items-center gap-1.5 font-semibold text-ink"><ShieldCheck className="h-4 w-4 text-lagoon-600" /> {t}</p>
                <p className="mt-1 text-sm text-muted">{d}</p>
              </div>
            ))}
          </div>
          <div className="card p-5 sm:p-6">
            <VerifyForm phone={profile?.phone ?? ""} />
          </div>
        </>
      )}
    </div>
  );
}
