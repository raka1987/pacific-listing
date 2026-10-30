import { requireStaff } from "@/lib/auth";
import { SubmitButton } from "@/components/submit-button";
import { createClient } from "@/lib/supabase/server";
import type { PaymentDetails } from "@/lib/types";
import { adminUpdateSettings } from "../actions";

export const metadata = { title: "Settings" };

export default async function AdminSettings() {
  await requireStaff(["admin"]);
  const supabase = await createClient();
  const { data: s } = await supabase.from("site_settings").select("*").eq("id", 1).single();
  const pay = (s?.payment_details ?? {}) as PaymentDetails;

  return (
    <div className="max-w-3xl">
      <h1 className="mb-5 font-display text-2xl font-semibold">Site settings</h1>
      <form action={adminUpdateSettings} className="space-y-6">
        <section className="card divide-y divide-line">
          <h2 className="px-5 pt-5 pb-3 font-bold">Posting</h2>
          <label className="flex cursor-pointer items-start justify-between gap-6 p-5">
            <span>
              <span className="block font-semibold text-ink">Review new ads before they go live</span>
              <span className="mt-0.5 block text-sm text-muted">
                When on, new ads wait in <strong>Listings → Needs review</strong> until approved. When off, ads go live instantly and you moderate using reports.
              </span>
            </span>
            <input type="checkbox" name="require_approval" defaultChecked={s?.require_approval} className="mt-1 h-5 w-5 shrink-0 accent-lagoon-600" />
          </label>
          <div className="grid gap-4 p-5 sm:grid-cols-[1fr_160px] sm:items-center">
            <span>
              <label className="block font-semibold text-ink" htmlFor="free_ad_limit">Free live ads per person</label>
              <span className="mt-0.5 block text-sm text-muted">How many ads a regular member can have live at once. Leave empty for no limit. Business plans set their own limit.</span>
            </span>
            <input id="free_ad_limit" name="free_ad_limit" type="number" min={0} defaultValue={s?.free_ad_limit ?? ""} placeholder="No limit" className="input" />
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-[1fr_160px] sm:items-center">
            <span>
              <label className="block font-semibold text-ink" htmlFor="launch_offer_days">Launch offer: first ad featured free</label>
              <span className="mt-0.5 block text-sm text-muted">
                Each new seller&apos;s first ad is featured on the homepage for this many days. Great for filling the site early on. Leave empty to switch off.
              </span>
            </span>
            <input id="launch_offer_days" name="launch_offer_days" type="number" min={1} max={60} defaultValue={s?.launch_offer_days ?? ""} placeholder="Off" className="input" />
          </div>
          <div className="p-5">
            <label className="block font-semibold text-ink" htmlFor="announcement">Announcement banner</label>
            <p className="mt-0.5 mb-3 text-sm text-muted">Shown in a strip at the top of every page. Leave empty to hide it.</p>
            <input id="announcement" name="announcement" defaultValue={s?.announcement ?? ""} className="input" placeholder="e.g. Pacific Listing is now live in Samoa!" />
          </div>
        </section>

        <section className="card space-y-4 p-5">
          <div>
            <h2 className="font-bold">How customers pay you</h2>
            <p className="text-sm text-muted">Shown on the payment page with the order number as the reference. Leave a method empty to hide it.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="mpaisa_number" label="M-PAiSA number" value={pay.mpaisa_number} placeholder="e.g. 9123456" />
            <Field id="mycash_number" label="MyCash number" value={pay.mycash_number} placeholder="e.g. 7123456" />
            <Field id="bank_name" label="Bank" value={pay.bank_name} placeholder="e.g. BSP Fiji" />
            <Field id="bank_account_name" label="Account name" value={pay.bank_account_name} placeholder="e.g. Pacific Listing Ltd" />
            <Field id="bank_account_number" label="Account number" value={pay.bank_account_number} />
            <Field id="bank_branch" label="Branch / BSB" value={pay.bank_branch} />
          </div>
          <div>
            <label className="label" htmlFor="instructions">Extra instructions</label>
            <input id="instructions" name="instructions" defaultValue={pay.instructions ?? ""} className="input" />
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-subtle p-4">
            <input type="checkbox" name="card_payments_enabled" defaultChecked={s?.card_payments_enabled} className="mt-1 h-4 w-4 accent-lagoon-600" />
            <span>
              <span className="block text-sm font-semibold text-ink">Offer card payments</span>
              <span className="text-xs text-muted">Turn on once your bank&apos;s online payment gateway (for example BSP, ANZ or Westpac) is connected by a developer.</span>
            </span>
          </label>
        </section>

        <div className="flex justify-end">
          <SubmitButton pendingText="Saving…">Save settings</SubmitButton>
        </div>
      </form>
    </div>
  );
}

function Field({ id, label, value, placeholder }: { id: string; label: string; value?: string; placeholder?: string }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} name={id} defaultValue={value ?? ""} placeholder={placeholder} className="input" />
    </div>
  );
}
