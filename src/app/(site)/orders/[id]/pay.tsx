"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Copy } from "lucide-react";
import { cancelOrder, submitPayment } from "@/app/actions";
import { FormMessage } from "@/components/auth-card";
import { PaymentMethodPicker, type PickableMethod } from "@/components/payment-methods";
import { SubmitButton } from "@/components/submit-button";
import type { PaymentDetails } from "@/lib/types";

export function PayOrder({
  orderId,
  orderNumber,
  amountLabel,
  initialMethod,
  details,
  cardEnabled,
  canCancel,
}: {
  orderId: string;
  orderNumber: string;
  amountLabel: string;
  initialMethod: PickableMethod;
  details: PaymentDetails;
  cardEnabled: boolean;
  canCancel: boolean;
}) {
  const [method, setMethod] = useState<PickableMethod>(initialMethod);
  const [state, action] = useActionState(submitPayment.bind(null, orderId), {});
  const [cancelling, startCancel] = useTransition();
  const router = useRouter();

  if (state.ok) {
    return (
      <div className="card p-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-lagoon-600" />
        <h2 className="font-display mt-3 text-xl font-semibold">Thanks, we&apos;ve got your payment details</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
          Our team will confirm the payment, usually within one working day. Your purchase switches on as soon as it&apos;s confirmed.
        </p>
      </div>
    );
  }

  const rows: [string, string | undefined][] =
    method === "mpaisa"
      ? [["Send to M-PAiSA number", details.mpaisa_number]]
      : method === "mycash"
        ? [["Send to MyCash number", details.mycash_number]]
        : method === "bank"
          ? [
              ["Bank", details.bank_name],
              ["Account name", details.bank_account_name],
              ["Account number", details.bank_account_number],
              ["Branch / BSB", details.bank_branch],
            ]
          : [];

  return (
    <div className="space-y-6">
      <section className="card p-5 sm:p-6">
        <h2 className="font-display text-xl font-semibold">1. Choose how to pay</h2>
        <div className="mt-4">
          <PaymentMethodPicker value={method} onChange={setMethod} cardEnabled={cardEnabled} name="method-pick" />
        </div>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="font-display text-xl font-semibold">2. Send the payment</h2>
        {method === "card" ? (
          <p className="mt-3 text-sm text-muted">Card payments open your bank&apos;s secure payment page. (Switched on by the site owner once their bank gateway is connected.)</p>
        ) : (
          <dl className="mt-4 divide-y divide-line rounded-2xl border border-line">
            <Row label="Amount" value={amountLabel} strong />
            <Row label="Reference" value={orderNumber} strong copy />
            {rows.map(([l, v]) => (
              <Row key={l} label={l} value={v || "Not set up yet"} copy={!!v} />
            ))}
          </dl>
        )}
        {details.instructions && method !== "card" && <p className="mt-3 text-sm text-muted">{details.instructions}</p>}
      </section>

      <form action={action} className="card space-y-4 p-5 sm:p-6">
        <h2 className="font-display text-xl font-semibold">3. Tell us you&apos;ve paid</h2>
        <FormMessage error={state.error} />
        <input type="hidden" name="method" value={method} />
        <div>
          <label className="label" htmlFor="reference">Transaction or receipt number</label>
          <input id="reference" name="reference" required maxLength={120} className="input" placeholder="e.g. MP240518.1432.A12345" />
          <p className="mt-1.5 text-xs text-muted">You&apos;ll find it in the confirmation SMS or on your bank receipt.</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {canCancel ? (
            <button
              type="button"
              disabled={cancelling}
              onClick={() => startCancel(async () => { await cancelOrder(orderId); router.refresh(); })}
              className="text-sm font-medium text-muted hover:text-red-600"
            >
              Cancel this order
            </button>
          ) : (
            <span />
          )}
          <SubmitButton className="btn-primary px-6" pendingText="Sending…">I&apos;ve paid</SubmitButton>
        </div>
      </form>
    </div>
  );
}

function Row({ label, value, strong, copy }: { label: string; value: string; strong?: boolean; copy?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className={`flex items-center gap-2 text-right ${strong ? "font-display text-lg font-semibold text-ink" : "text-sm font-semibold text-ink"}`}>
        <span className="select-all">{value}</span>
        {copy && (
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(value);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } catch {}
            }}
            className="rounded-lg p-1 text-faint hover:bg-subtle hover:text-ink"
            aria-label={`Copy ${label}`}
          >
            {copied ? <CheckCircle2 className="h-4 w-4 text-lagoon-600" /> : <Copy className="h-4 w-4" />}
          </button>
        )}
      </dd>
    </div>
  );
}
