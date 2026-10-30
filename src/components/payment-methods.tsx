"use client";

import { Building2, CreditCard, Smartphone, Wallet } from "lucide-react";
import { PAYMENT_METHODS } from "@/lib/constants";

const ICONS = { mpaisa: Smartphone, mycash: Wallet, bank: Building2, card: CreditCard } as const;
const HINTS = {
  mpaisa: "Vodafone mobile money",
  mycash: "Digicel mobile money",
  bank: "Any bank, online or in branch",
  card: "Visa or Mastercard",
} as const;

export type PickableMethod = keyof typeof ICONS;

export function PaymentMethodPicker({
  value,
  onChange,
  cardEnabled,
  name = "method",
}: {
  value: PickableMethod;
  onChange: (m: PickableMethod) => void;
  cardEnabled: boolean;
  name?: string;
}) {
  const methods = (Object.keys(ICONS) as PickableMethod[]).filter((m) => m !== "card" || cardEnabled);
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {methods.map((m) => {
        const Icon = ICONS[m];
        return (
          <label key={m} className="cursor-pointer">
            <input type="radio" name={name} value={m} checked={value === m} onChange={() => onChange(m)} className="peer sr-only" />
            <span className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 transition peer-checked:border-lagoon-500 peer-checked:bg-lagoon-50 peer-focus-visible:ring-2 peer-focus-visible:ring-lagoon-400 hover:border-faint">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-subtle text-ink">
                <Icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-ink">{PAYMENT_METHODS[m]}</span>
                <span className="text-xs text-muted">{HINTS[m]}</span>
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
