"use client";

import { CheckCircle2, Flag, X } from "lucide-react";
import { useState, useTransition } from "react";
import { reportListing } from "@/app/actions";
import { reportChat } from "@/app/chat-actions";
import { CHAT_REPORT_REASONS, REPORT_REASONS } from "@/lib/constants";

/** Report an ad, or (with conversationId) a chat. */
export function ReportDialog({ listingId, conversationId, triggerClassName }: { listingId?: string; conversationId?: string; triggerClassName?: string }) {
  const what = conversationId ? "chat" : "ad";
  const reasons = conversationId ? CHAT_REPORT_REASONS : REPORT_REASONS;
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) return setError("Choose a reason.");
    startTransition(async () => {
      const res = conversationId ? await reportChat(conversationId, reason, details) : await reportListing(listingId!, reason, details);
      if (res.error) setError(res.error);
      else setDone(true);
    });
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className={triggerClassName ?? "inline-flex items-center gap-1.5 text-sm text-muted hover:text-red-600"}>
        <Flag className="h-4 w-4" /> Report this {what}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={`Report ${what}`}>
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-md rounded-t-3xl bg-surface p-6 sm:rounded-3xl">
            <button onClick={() => setOpen(false)} className="absolute top-4 right-4 text-faint hover:text-ink-2" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
            {done ? (
              <div className="py-6 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-lagoon-600" />
                <h2 className="mt-3 text-lg font-bold">Thanks for letting us know</h2>
                <p className="mt-1 text-sm text-muted">Our team will review this {what} shortly.</p>
                <button onClick={() => setOpen(false)} className="btn-primary mt-5">Close</button>
              </div>
            ) : (
              <form onSubmit={submit}>
                <h2 className="text-lg font-bold">Report this {what}</h2>
                <p className="mt-1 text-sm text-muted">{conversationId
                    ? "Our team will be able to read this chat to check what happened."
                    : "Help keep Pacific Listing safe. Reports are anonymous."}</p>
                <div className="mt-4 space-y-2">
                  {reasons.map((r) => (
                    <label key={r} className="flex cursor-pointer items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-sm has-[:checked]:border-lagoon-500 has-[:checked]:bg-lagoon-50">
                      <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-lagoon-600" />
                      {r}
                    </label>
                  ))}
                </div>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Anything else we should know? (optional)"
                  rows={3}
                  className="input mt-3"
                />
                {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
                <button disabled={pending} className="btn-primary mt-4 w-full">
                  {pending ? "Sending…" : "Send report"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
