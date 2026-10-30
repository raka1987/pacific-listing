"use client";

import { Wand2 } from "lucide-react";
import { useRef } from "react";
import { CURRENCIES, FJD_RATES } from "@/lib/constants";
import type { Prices } from "@/lib/types";

function suggest(fjd: number, currency: string) {
  const v = fjd * (FJD_RATES[currency] ?? 1);
  if (currency === "VUV" || currency === "XPF") return Math.round(v / 100) * 100;
  return Math.max(1, Math.round(v));
}

/** One price box per currency. Empty means "not sold in that currency". */
export function PriceGrid({ prices, prefix = "price_", compact = false }: { prices: Prices; prefix?: string; compact?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  function fillFromFjd() {
    const root = ref.current;
    if (!root) return;
    const fjd = Number((root.querySelector(`[name="${prefix}FJD"]`) as HTMLInputElement)?.value);
    if (!fjd) return;
    for (const c of CURRENCIES) {
      if (c === "FJD") continue;
      const input = root.querySelector(`[name="${prefix}${c}"]`) as HTMLInputElement | null;
      if (input) input.value = String(suggest(fjd, c));
    }
  }

  return (
    <div ref={ref}>
      <div className={`grid gap-2 ${compact ? "grid-cols-5" : "grid-cols-2 sm:grid-cols-5"}`}>
        {CURRENCIES.map((c) => (
          <label key={c} className="block">
            <span className="mb-1 block text-[11px] font-semibold tracking-wide text-muted">{c}</span>
            <input
              name={`${prefix}${c}`}
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              defaultValue={prices[c] ?? ""}
              className="w-full rounded-xl border border-line bg-surface px-2.5 py-2 text-sm text-ink tabular-nums focus:border-lagoon-500 focus:ring-2 focus:ring-lagoon-500/15 focus:outline-none"
            />
          </label>
        ))}
      </div>
      <button type="button" onClick={fillFromFjd} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-lagoon-700 hover:underline">
        <Wand2 className="h-3.5 w-3.5" /> Fill other currencies from the FJD price
      </button>
    </div>
  );
}
