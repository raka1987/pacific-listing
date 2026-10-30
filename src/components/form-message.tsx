"use client";

import { MailCheck } from "lucide-react";
import { useEffect, useRef } from "react";

/**
 * Error or success note at the top of a form. It scrolls itself into view, because on a phone
 * the send button is often far below it and people would otherwise think nothing happened.
 */
export function FormMessage({ error, message }: { error?: string; message?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [error, message]);
  if (error) return <p ref={ref} className="scroll-mt-24 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>;
  if (message) return <p ref={ref} className="scroll-mt-24 rounded-xl bg-lagoon-50 p-3 text-sm text-lagoon-800" role="status">{message}</p>;
  return null;
}

/** Full "check your email" screen shown after signing up or asking for a reset link. */
export function CheckEmail({ title = "Check your email", children }: { title?: string; children: React.ReactNode }) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  return (
    <div className="py-2 text-center" role="status">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-lagoon-50 text-lagoon-600">
        <MailCheck className="h-8 w-8" />
      </span>
      <h2 className="font-display mt-4 text-2xl font-semibold text-ink">{title}</h2>
      <div className="mt-2 space-y-3 text-sm text-ink-2">{children}</div>
    </div>
  );
}
