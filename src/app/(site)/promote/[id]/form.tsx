"use client";

import { useActionState, useState } from "react";
import { Check, Clock, Sparkles, TrendingUp, Zap } from "lucide-react";
import { createBoostOrder } from "@/app/actions";
import { FormMessage } from "@/components/auth-card";
import { PaymentMethodPicker, type PickableMethod } from "@/components/payment-methods";
import { SubmitButton } from "@/components/submit-button";
import { formatMoney, priceIn } from "@/lib/format";
import type { BoostPackage } from "@/lib/types";

const KIND_ICON = { featured: Sparkles, bump: TrendingUp, urgent: Zap };

export function PromoteForm({
  listingId,
  packages,
  currency,
  cardEnabled,
  freeBumpsLeft,
}: {
  listingId: string;
  packages: BoostPackage[];
  currency: string;
  cardEnabled: boolean;
  freeBumpsLeft: number;
}) {
  const [state, action] = useActionState(createBoostOrder, {});
  const available = packages.filter((p) => priceIn(p.prices, currency) != null);
  const [pkg, setPkg] = useState(available[0]?.id ?? "");
  const [method, setMethod] = useState<PickableMethod>("mpaisa");
  const chosen = available.find((p) => p.id === pkg);
  const free = chosen?.kind === "bump" && freeBumpsLeft > 0;

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="listing_id" value={listingId} />
      <FormMessage error={state.error} />
      <section className="card p-5 sm:p-6">
        <h2 className="font-display text-xl font-semibold">1. Choose a promotion</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {available.map((p) => {
            const Icon = KIND_ICON[p.kind];
            const isFree = p.kind === "bump" && freeBumpsLeft > 0;
            return (
              <label key={p.id} className="cursor-pointer">
                <input type="radio" name="package_id" value={p.id} checked={pkg === p.id} onChange={() => setPkg(p.id)} className="peer sr-only" />
                <span className="flex h-full flex-col rounded-2xl border border-line bg-surface p-4 transition peer-checked:border-lagoon-500 peer-checked:bg-lagoon-50 peer-checked:ring-1 peer-checked:ring-lagoon-500 peer-focus-visible:ring-2 hover:border-faint">
                  <span className="flex items-start justify-between gap-3">
                    <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${p.kind === "urgent" ? "bg-red-100 text-red-700" : p.kind === "bump" ? "bg-sky-100 text-sky-700" : "bg-coral-400/15 text-coral-600"}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-right">
                      <span className="block font-display text-lg font-semibold text-ink">
                        {isFree ? "Free" : formatMoney(priceIn(p.prices, currency), currency)}
                      </span>
                      {isFree && <span className="text-xs text-lagoon-700">{freeBumpsLeft} free left this month</span>}
                    </span>
                  </span>
                  <span className="mt-3 font-semibold text-ink">{p.name}</span>
                  <span className="mt-0.5 text-sm text-muted">{p.description}</span>
                  {p.duration_days && (
                    <span className="mt-3 flex items-center gap-1 text-xs font-medium text-ink-2">
                      <Clock className="h-3.5 w-3.5" /> Runs for {p.duration_days} days, then ends on its own
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      </section>

      {!free && (
        <section className="card p-5 sm:p-6">
          <h2 className="font-display text-xl font-semibold">2. How will you pay?</h2>
          <p className="mt-1 text-sm text-muted">You&apos;ll get the payment details and your reference number on the next screen.</p>
          <div className="mt-4">
            <PaymentMethodPicker value={method} onChange={setMethod} cardEnabled={cardEnabled} />
          </div>
        </section>
      )}
      {free && <input type="hidden" name="method" value="mpaisa" />}

      <div className="card flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="text-sm text-muted">Total</p>
          <p className="font-display text-2xl font-semibold text-ink">{free ? "Free" : formatMoney(priceIn(chosen?.prices, currency), currency)}</p>
        </div>
        <SubmitButton className="btn-accent px-8 py-3 text-base" pendingText="One moment…">
          {free ? (
            <>
              <Check className="h-4 w-4" /> Bump now
            </>
          ) : (
            "Continue to payment"
          )}
        </SubmitButton>
      </div>
    </form>
  );
}
