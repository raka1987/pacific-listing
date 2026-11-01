import Link from "next/link";
import { BadgeCheck, Check, X } from "lucide-react";
import { reviewVerification } from "@/app/alerts-actions";
import { MOD_ROLES, requireStaff } from "@/lib/auth";
import { formatDate, timeAgo } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { ActionButton } from "../ui";

export const metadata = { title: "Verification" };

type Request = {
  id: string;
  user_id: string;
  phone: string;
  business_name: string | null;
  document_path: string | null;
  status: string;
  reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  member: { full_name: string; created_at: string } | null;
};

export default async function AdminVerification({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireStaff(MOD_ROLES);
  const { status = "pending" } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("verification_requests")
    .select("id, user_id, phone, business_name, document_path, status, reason, created_at, reviewed_at, member:profiles!verification_requests_user_id_fkey(full_name, created_at)")
    .eq("status", status)
    .order("created_at", { ascending: status === "pending" })
    .limit(100);
  const requests = (data ?? []) as unknown as Request[];
  // Short-lived private links to the ID photos.
  const paths = requests.map((r) => r.document_path).filter((p): p is string => !!p);
  const { data: signed } = paths.length ? await supabase.storage.from("verification").createSignedUrls(paths, 600) : { data: [] };
  const urlFor = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  const btn = "inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink-2 hover:bg-subtle";

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-ink">Seller verification</h1>
      <p className="mb-5 text-sm text-muted">
        Check the ID matches the member&apos;s name. If unsure, call the phone number. The ID photo is deleted as soon as you decide.
      </p>
      <div className="mb-4 flex gap-2">
        {["pending", "approved", "rejected"].map((s) => (
          <Link
            key={s}
            href={`/admin/verification?status=${s}`}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold capitalize ${status === s ? "bg-ink text-canvas" : "bg-surface text-ink-2 ring-1 ring-line"}`}
          >
            {s}
          </Link>
        ))}
      </div>
      {requests.length ? (
        <ul className="space-y-4">
          {requests.map((r) => {
            const url = r.document_path ? urlFor.get(r.document_path) : null;
            return (
              <li key={r.id} className="card flex flex-col gap-4 p-4 md:flex-row">
                {status === "pending" && (
                  <div className="md:w-72 md:shrink-0">
                    {url ? (
                      r.document_path?.endsWith(".pdf") ? (
                        <a href={url} target="_blank" rel="noreferrer" className={btn}>Open ID document (PDF)</a>
                      ) : (
                        <a href={url} target="_blank" rel="noreferrer" title="Open full size">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="ID document" className="max-h-56 w-full rounded-xl bg-subtle object-contain" />
                        </a>
                      )
                    ) : (
                      <p className="text-sm text-muted">No ID photo.</p>
                    )}
                  </div>
                )}
                <div className="min-w-0 flex-1 space-y-1 text-sm">
                  <Link href={`/admin/users/${r.user_id}`} className="text-base font-semibold text-ink hover:underline">
                    {r.member?.full_name || "Member"}
                  </Link>
                  <p className="text-ink-2">Phone: <a href={`tel:${r.phone.replace(/\s/g, "")}`} className="font-medium text-lagoon-700">{r.phone}</a></p>
                  {r.business_name && <p className="text-ink-2">Business: {r.business_name}</p>}
                  <p className="text-muted">
                    Member since {r.member ? formatDate(r.member.created_at) : "?"} · asked {timeAgo(r.created_at)}
                    {r.reviewed_at && <> · decided {timeAgo(r.reviewed_at)}</>}
                  </p>
                  {r.reason && <p className="text-muted">Reason: {r.reason}</p>}
                  {status === "pending" && (
                    <div className="flex flex-wrap items-start gap-2 pt-3">
                      <form action={reviewVerification.bind(null, r.id, true)}>
                        <ActionButton className={`${btn} border-lagoon-200 text-lagoon-700`}>
                          <Check className="h-4 w-4" /> Approve
                        </ActionButton>
                      </form>
                      <form action={reviewVerification.bind(null, r.id, false)} className="flex flex-wrap gap-2">
                        <input name="reason" placeholder="Reason (sent to the member)" className="input w-64 py-2" />
                        <ActionButton className={`${btn} text-red-600`}>
                          <X className="h-4 w-4" /> Reject
                        </ActionButton>
                      </form>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="card flex flex-col items-center p-10 text-center text-sm text-muted">
          <BadgeCheck className="mb-2 h-8 w-8 text-faint" /> No {status} requests.
        </div>
      )}
    </div>
  );
}
