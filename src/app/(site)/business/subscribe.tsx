"use client";

import { useActionState, useState } from "react";
import { createSubscriptionOrder } from "@/app/actions";
import { FormMessage } from "@/components/auth-card";
import { PaymentMethodPicker, type PickableMethod } from "@/components/payment-methods";
import { SubmitButton } from "@/components/submit-button";

export function SubscribeForm({ planId, planName, priceLabel, cardEnabled, defaultName, currency }: { planId: string; planName: string; priceLabel: string; cardEnabled: boolean; defaultName: string; currency: string }) {
  const [state, action] = useActionState(createSubscriptionOrder, {});
  const [method, setMethod] = useState<PickableMethod>("mpaisa");
  return (
    <form action={action} className="card space-y-5 p-5 sm:p-6">
      <input type="hidden" name="plan_id" value={planId} />
      <input type="hidden" name="currency" value={currency} />
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl font-bold">Start {planName}</h2>
        <span className="font-display text-xl font-bold text-ink">{priceLabel}</span>
      </div>
      <FormMessage error={state.error} />
      <div>
        <label className="label" htmlFor="business_name">Business name</label>
        <input id="business_name" name="business_name" required defaultValue={defaultName} className="input" placeholder="e.g. Suva Auto Traders" />
        <p className="mt-1 text-xs text-muted">Shown on your ads and shop page.</p>
      </div>
      <div>
        <span className="label">How will you pay?</span>
        <PaymentMethodPicker value={method} onChange={setMethod} cardEnabled={cardEnabled} />
      </div>
      <SubmitButton className="btn-accent w-full py-3 text-base" pendingText="One moment…">Continue to payment</SubmitButton>
    </form>
  );
}
