"use client";

import { Check, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { setViewerCountry } from "@/app/location-actions";

type Region = { code: string; name: string; currency: string; flag: string };

export function CountryPicker({ regions, current }: { regions: Region[]; current: { code: string | null; flag: string; currency: string } }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex h-10 items-center gap-1.5 rounded-full px-2.5 text-sm font-semibold text-ink-2 transition hover:bg-subtle hover:text-ink ${pending ? "opacity-60" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Your country and currency: ${current.currency}. Change`}
      >
        <span className="text-base leading-none">{current.flag}</span>
        <span className="hidden sm:inline">{current.currency}</span>
        <ChevronDown className="hidden h-3.5 w-3.5 sm:block" />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 max-h-[70vh] w-64 overflow-y-auto rounded-2xl border border-line bg-surface p-2 shadow-xl" role="listbox">
          <p className="px-3 pt-1 pb-2 text-xs text-muted">Where are you? We use this for prices and local ads.</p>
          {regions.map((r) => (
            <button
              key={r.code}
              role="option"
              aria-selected={r.code === current.code}
              onClick={() =>
                start(async () => {
                  await setViewerCountry(r.code);
                  setOpen(false);
                  router.refresh();
                })
              }
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-ink-2 hover:bg-subtle"
            >
              <span>{r.flag}</span>
              <span className="flex-1">{r.name}</span>
              <span className="text-xs text-muted">{r.currency}</span>
              {r.code === current.code && <Check className="h-4 w-4 text-lagoon-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
