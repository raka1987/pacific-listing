"use client";

import { CheckCircle2, Star, X } from "lucide-react";
import { useState, useTransition } from "react";
import { submitReview } from "@/app/alerts-actions";

const LABELS = ["", "Poor", "Not great", "OK", "Good", "Excellent"];

/** "Rate this member" button and dialog, used in chats. */
export function RateMember({
  conversationId,
  name,
  existing,
  className,
}: {
  conversationId: string;
  name: string;
  existing: { rating: number; comment: string | null } | null;
  className: string;
}) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const first = name.split(" ")[0];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) return setError("Tap a star to choose a rating.");
    start(async () => {
      const res = await submitReview(conversationId, rating, comment);
      if (res.error) setError(res.error);
      else setDone(true);
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        <Star className="h-4 w-4" /> {existing ? `Change your rating of ${first}` : `Rate ${first}`}
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={`Rate ${name}`}>
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-md rounded-t-3xl bg-surface p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:rounded-3xl sm:pb-6">
            <button onClick={() => setOpen(false)} className="absolute top-4 right-4 text-faint hover:text-ink-2" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
            {done ? (
              <div className="py-6 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-lagoon-600" />
                <h2 className="mt-3 text-lg font-bold">Thanks for your rating</h2>
                <p className="mt-1 text-sm text-muted">It shows on {first}&apos;s seller page and helps others trade safely.</p>
                <button onClick={() => setOpen(false)} className="btn-primary mt-5">Close</button>
              </div>
            ) : (
              <form onSubmit={submit}>
                <h2 className="text-lg font-bold">How was it dealing with {first}?</h2>
                <p className="mt-1 text-sm text-muted">Your rating and comment are public, with your name.</p>
                <div className="mt-5 flex items-center justify-center gap-1" onMouseLeave={() => setHover(0)}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setRating(i);
                        setError("");
                      }}
                      onMouseEnter={() => setHover(i)}
                      className="p-1"
                      aria-label={`${i} star${i > 1 ? "s" : ""}`}
                      aria-pressed={rating === i}
                    >
                      <Star className={`h-9 w-9 transition ${(hover || rating) >= i ? "text-amber-400" : "text-line"}`} fill="currentColor" strokeWidth={0} />
                    </button>
                  ))}
                </div>
                <p className="h-5 text-center text-sm font-medium text-ink-2">{LABELS[hover || rating]}</p>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  maxLength={1000}
                  rows={3}
                  placeholder="What went well, or not? (optional)"
                  className="input mt-3"
                />
                {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
                <button disabled={pending} className="btn-primary mt-4 w-full">
                  {pending ? "Saving…" : "Save rating"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
