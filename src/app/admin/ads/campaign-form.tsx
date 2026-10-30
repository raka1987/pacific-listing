"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { FormMessage } from "@/components/auth-card";
import { SubmitButton } from "@/components/submit-button";
import { CATEGORIES, COUNTRIES, CURRENCIES, IMAGE_BUCKET } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { compressImage } from "@/lib/image";
import { createClient } from "@/lib/supabase/client";
import type { AdSlot, Campaign } from "@/lib/types";
import { adminSaveCampaign } from "../actions";

const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (d: string, n: number) => new Date(new Date(d).getTime() + n * 86400000).toISOString().slice(0, 10);

export function CampaignForm({ campaign, slots, userId }: { campaign?: Campaign; slots: AdSlot[]; userId: string }) {
  const [state, action] = useActionState(adminSaveCampaign.bind(null, campaign?.id ?? null), {});
  const [slot, setSlot] = useState(campaign?.slot_code ?? slots[0]?.code ?? "");
  const [start, setStart] = useState(campaign?.starts_on ?? today());
  const [end, setEnd] = useState(campaign?.ends_on ?? plusDays(today(), 27));
  const [currency, setCurrency] = useState(campaign?.currency ?? "FJD");
  const [image, setImage] = useState(campaign?.image_url ?? "");
  const [reach, setReach] = useState<"global" | "countries">(campaign && campaign.countries.length === 0 ? "global" : "countries");
  const [picked, setPicked] = useState<string[]>(campaign?.countries ?? []);
  const [uploading, setUploading] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  const weeks = Math.max(1, Math.ceil((new Date(end).getTime() - new Date(start).getTime() + 86400000) / (7 * 86400000)));
  const slotRow = slots.find((s) => s.code === slot);
  const countryRate = slotRow?.prices[currency];
  const globalRate = slotRow?.global_prices[currency];
  // Several countries cost one country's rate each, but never more than a global campaign.
  const rate =
    reach === "global"
      ? globalRate
      : countryRate != null
        ? Math.min(countryRate * Math.max(1, picked.length), globalRate ?? Infinity)
        : undefined;
  const suggested = rate != null ? rate * weeks : null;
  const sizeHint = useMemo(() => slots.find((s) => s.code === slot)?.size_hint, [slot, slots]);

  async function upload(file?: File) {
    if (!file) return;
    setUploading(true);
    const supabase = createClient();
    const blob = await compressImage(file, 2000, 0.85);
    const path = `${userId}/ad-${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, blob, { contentType: "image/jpeg" });
    if (!error) setImage(supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl);
    setUploading(false);
  }

  return (
    <form action={action} className="space-y-6">
      <FormMessage error={state.error} />
      <input type="hidden" name="image_url" value={image} />

      <section className="card space-y-4 p-5 sm:p-6">
        <h2 className="font-display text-lg font-bold">Advertiser</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="advertiser_name">Business name</label>
            <input id="advertiser_name" name="advertiser_name" required defaultValue={campaign?.advertiser_name} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="advertiser_email">Email</label>
            <input id="advertiser_email" name="advertiser_email" type="email" defaultValue={campaign?.advertiser_email ?? ""} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="advertiser_phone">Phone</label>
            <input id="advertiser_phone" name="advertiser_phone" defaultValue={campaign?.advertiser_phone ?? ""} className="input" />
          </div>
        </div>
      </section>

      <section className="card space-y-4 p-5 sm:p-6">
        <h2 className="font-display text-lg font-bold">The banner</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="title">Campaign name</label>
            <input id="title" name="title" required defaultValue={campaign?.title} className="input" placeholder="e.g. Christmas tyre sale" />
            <p className="mt-1 text-xs text-muted">Also used as the image description for screen readers.</p>
          </div>
          <div>
            <label className="label" htmlFor="link_url">Where it links to</label>
            <input id="link_url" name="link_url" type="url" defaultValue={campaign?.link_url ?? ""} className="input" placeholder="https://" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="slot_code">Ad spot</label>
          <select id="slot_code" name="slot_code" value={slot} onChange={(e) => setSlot(e.target.value)} className="input">
            {slots.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className="label">Image {sizeHint && <span className="font-normal text-muted">· best at {sizeHint}</span>}</span>
          <div className="flex flex-wrap items-center gap-4">
            <div className={`flex items-center justify-center overflow-hidden rounded-2xl border border-dashed border-line bg-subtle ${slot === "listing_sidebar" ? "aspect-[4/3] w-48" : "aspect-[4/1] w-full max-w-xl"}`}>
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-sm text-muted">No image yet</span>
              )}
            </div>
            <label className="btn-secondary cursor-pointer">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              {image ? "Replace image" : "Upload image"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
            </label>
          </div>
        </div>
      </section>

      <section className="card space-y-5 p-5 sm:p-6">
        <h2 className="font-display text-lg font-bold">Who sees it</h2>
        <fieldset className="space-y-3">
          <legend className="label">Countries</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              ["countries", "Selected countries", "Only visitors in the countries you tick. Best for local businesses."],
              ["global", "All countries (global)", "Every visitor, wherever they are. For airlines, travel deals and big brands."],
            ].map(([v, l, d]) => (
              <label key={v} className="cursor-pointer">
                <input type="radio" name="reach" value={v} checked={reach === v} onChange={() => setReach(v as "global" | "countries")} className="peer sr-only" />
                <span className="block h-full rounded-2xl border border-line p-3.5 peer-checked:border-lagoon-500 peer-checked:bg-lagoon-50 peer-focus-visible:ring-2">
                  <span className="block text-sm font-semibold text-ink">{l}</span>
                  <span className="text-xs text-muted">{d}</span>
                </span>
              </label>
            ))}
          </div>
          <div className={`flex flex-wrap gap-2 ${reach === "global" ? "hidden" : ""}`}>
            {COUNTRIES.map((c) => (
              <label key={c.code} className="cursor-pointer">
                <input
                  type="checkbox"
                  name="countries"
                  value={c.code}
                  checked={picked.includes(c.code)}
                  onChange={(e) => setPicked((p) => (e.target.checked ? [...p, c.code] : p.filter((x) => x !== c.code)))}
                  className="peer sr-only"
                />
                <span className="chip py-1.5 peer-checked:border-lagoon-500 peer-checked:bg-lagoon-50 peer-checked:text-lagoon-800 peer-focus-visible:ring-2">
                  {c.flag} {c.name}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {slot !== "home_banner" && (
          <fieldset>
            <legend className="label">Categories <span className="font-normal text-muted">(none ticked = all)</span></legend>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <label key={c.slug} className="cursor-pointer">
                  <input type="checkbox" name="categories" value={c.slug} defaultChecked={campaign?.categories.includes(c.slug)} className="peer sr-only" />
                  <span className="chip py-1.5 peer-checked:border-lagoon-500 peer-checked:bg-lagoon-50 peer-checked:text-lagoon-800 peer-focus-visible:ring-2">{c.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
      </section>

      <section className="card space-y-4 p-5 sm:p-6">
        <h2 className="font-display text-lg font-bold">Dates and price</h2>
        <div className="grid gap-4 sm:grid-cols-4">
          <div>
            <label className="label" htmlFor="starts_on">Starts</label>
            <input id="starts_on" name="starts_on" type="date" value={start} onChange={(e) => setStart(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="ends_on">Ends</label>
            <input id="ends_on" name="ends_on" type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="currency">Currency</label>
            <select id="currency" name="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className="input">
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="amount">Price</label>
            <input id="amount" name="amount" ref={amountRef} type="number" min={0} step="any" defaultValue={campaign?.amount ?? suggested ?? ""} className="input" />
          </div>
        </div>
        {suggested != null && (
          <p className="text-sm text-muted">
            Rate card ({reach === "global" ? "global" : `${Math.max(1, picked.length)} ${picked.length === 1 ? "country" : "countries"}`}): {weeks}{" "}
            {weeks === 1 ? "week" : "weeks"} × {formatMoney(rate!, currency)} = <strong className="text-ink">{formatMoney(suggested, currency)}</strong>.{" "}
            <button type="button" className="font-semibold text-lagoon-700 hover:underline" onClick={() => amountRef.current && (amountRef.current.value = String(suggested))}>
              Use this price
            </button>
          </p>
        )}
        <div>
          <label className="label" htmlFor="notes">Private notes</label>
          <textarea id="notes" name="notes" rows={2} defaultValue={campaign?.notes ?? ""} className="input" placeholder="e.g. Agreed 10% discount for 3 months" />
        </div>
      </section>

      <div className="flex justify-end">
        <SubmitButton className="btn-primary px-8" pendingText="Saving…">{campaign ? "Save changes" : "Create campaign"}</SubmitButton>
      </div>
    </form>
  );
}
