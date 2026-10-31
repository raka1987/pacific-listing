"use client";

import Link from "next/link";
import { Bell, BellRing } from "lucide-react";
import { useState, useTransition } from "react";
import { saveSearch } from "@/app/alerts-actions";
import type { SearchFilters } from "@/lib/queries";

/** "Save search" on results pages: emails new matching ads once a day. */
export function SaveSearchButton({ filters, back, saved: initial }: { filters: SearchFilters; back: string; saved: boolean }) {
  const [saved, setSaved] = useState(initial);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  if (saved) {
    return (
      <Link href="/saved-searches" className="btn-secondary px-3.5 py-2 text-sm text-lagoon-700" title="We'll email you new matches">
        <BellRing className="h-4 w-4" /> Saved
      </Link>
    );
  }
  return (
    <div className="relative">
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await saveSearch(filters, back);
            if (res?.error) setError(res.error);
            else setSaved(true);
          })
        }
        className="btn-secondary px-3.5 py-2 text-sm"
        title="Get an email when new ads match this search"
      >
        <Bell className="h-4 w-4" /> {pending ? "Saving…" : "Save search"}
      </button>
      {error && <p className="absolute right-0 z-10 mt-1 w-60 rounded-lg bg-surface p-2 text-xs text-red-600 shadow-lg ring-1 ring-line">{error}</p>}
    </div>
  );
}
