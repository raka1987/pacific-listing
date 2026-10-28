"use client";

import { useActionState, useState } from "react";
import { AlertCircle } from "lucide-react";
import type { ListingFormState } from "@/app/actions";
import { CATEGORIES, COUNTRIES, categoryBySlug, countryByCode } from "@/lib/constants";
import type { Listing } from "@/lib/types";
import { CategoryIcon } from "./category-icon";
import { ImageUploader } from "./image-uploader";
import { SubmitButton } from "./submit-button";

type Defaults = { country: string | null; city: string | null; phone: string | null; whatsapp: string | null };

export function ListingForm({
  action,
  userId,
  listing,
  defaults,
}: {
  action: (state: ListingFormState, fd: FormData) => Promise<ListingFormState>;
  userId: string;
  listing?: Listing;
  defaults: Defaults;
}) {
  const [state, formAction] = useActionState(action, {});
  const [images, setImages] = useState<string[]>(listing?.images ?? []);
  const [category, setCategory] = useState(listing?.category ?? "");
  const [priceType, setPriceType] = useState<string>(listing?.price_type ?? "fixed");
  const [country, setCountry] = useState(listing?.country ?? defaults.country ?? "FJ");
  const fe = state.fieldErrors ?? {};
  const showCondition = categoryBySlug(category)?.hasCondition;
  const currency = countryByCode(country)?.currency ?? "";

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="images" value={JSON.stringify(images)} />

      {state.error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0" /> {state.error}
        </div>
      )}

      <Section title="Photos" hint="Add up to 8 photos. Ads with photos get far more replies.">
        <ImageUploader userId={userId} value={images} onChange={setImages} />
        <FieldError msg={fe.images} />
      </Section>

      <Section title="Category">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {CATEGORIES.map((c) => (
            <label key={c.slug} className="cursor-pointer">
              <input
                type="radio"
                name="category"
                value={c.slug}
                checked={category === c.slug}
                onChange={() => setCategory(c.slug)}
                className="peer sr-only"
              />
              <span className="flex h-full flex-col items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-3 text-center text-xs font-semibold text-slate-600 transition peer-checked:border-lagoon-500 peer-checked:bg-lagoon-50 peer-checked:text-lagoon-800 peer-focus-visible:ring-2 peer-focus-visible:ring-lagoon-400 hover:border-slate-300">
                <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${c.color}`}>
                  <CategoryIcon icon={c.icon} className="h-5 w-5" />
                </span>
                {c.name}
              </span>
            </label>
          ))}
        </div>
        <FieldError msg={fe.category} />
      </Section>

      <Section title="About your item">
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="title">Title</label>
            <input id="title" name="title" required maxLength={120} defaultValue={listing?.title} className="input" placeholder="e.g. 2015 Toyota Hilux, 4x4, low km" />
            <FieldError msg={fe.title} />
          </div>
          <div>
            <label className="label" htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              rows={6}
              maxLength={5000}
              defaultValue={listing?.description}
              className="input"
              placeholder="Describe the condition, features, and why you're selling. More detail means fewer questions."
            />
            <FieldError msg={fe.description} />
          </div>
          {showCondition && (
            <div>
              <span className="label">Condition</span>
              <div className="flex gap-2">
                {[["used", "Used"], ["new", "New"]].map(([v, l]) => (
                  <label key={v} className="flex-1 cursor-pointer">
                    <input type="radio" name="condition" value={v} defaultChecked={(listing?.condition ?? "used") === v} className="peer sr-only" />
                    <span className="block rounded-xl border border-slate-200 bg-white py-2.5 text-center text-sm font-medium text-slate-600 peer-checked:border-lagoon-500 peer-checked:bg-lagoon-50 peer-checked:text-lagoon-800">
                      {l}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </Section>

      <Section title="Price">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[["fixed", "Fixed price"], ["negotiable", "Negotiable"], ["free", "Free"], ["contact", "Ask for price"]].map(([v, l]) => (
            <label key={v} className="cursor-pointer">
              <input type="radio" name="price_type" value={v} checked={priceType === v} onChange={() => setPriceType(v)} className="peer sr-only" />
              <span className="block rounded-xl border border-slate-200 bg-white py-2.5 text-center text-sm font-medium text-slate-600 peer-checked:border-lagoon-500 peer-checked:bg-lagoon-50 peer-checked:text-lagoon-800">
                {l}
              </span>
            </label>
          ))}
        </div>
        {(priceType === "fixed" || priceType === "negotiable") && (
          <div className="mt-4 max-w-xs">
            <label className="label" htmlFor="price">Price</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-3.5 flex items-center text-sm font-semibold text-slate-500">{currency}</span>
              <input
                id="price"
                name="price"
                inputMode="decimal"
                defaultValue={listing?.price ?? ""}
                className="input pl-14"
                placeholder="0"
              />
            </div>
            <FieldError msg={fe.price} />
          </div>
        )}
      </Section>

      <Section title="Location">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="country">Country</label>
            <select id="country" name="country" value={country} onChange={(e) => setCountry(e.target.value)} className="input">
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
              ))}
            </select>
            <FieldError msg={fe.country} />
          </div>
          <div>
            <label className="label" htmlFor="city">Town / city / island</label>
            <input id="city" name="city" defaultValue={listing?.city ?? defaults.city ?? ""} className="input" placeholder="e.g. Suva, Nadi, Apia" />
          </div>
        </div>
      </Section>

      <Section title="How should buyers contact you?" hint="Leave blank to use the numbers on your profile.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="contact_phone">Phone number</label>
            <input id="contact_phone" name="contact_phone" type="tel" defaultValue={listing?.contact_phone ?? defaults.phone ?? ""} className="input" placeholder="+679 123 4567" />
          </div>
          <div>
            <label className="label" htmlFor="contact_whatsapp">WhatsApp number</label>
            <input id="contact_whatsapp" name="contact_whatsapp" type="tel" defaultValue={listing?.contact_whatsapp ?? defaults.whatsapp ?? ""} className="input" placeholder="+679 123 4567" />
          </div>
        </div>
      </Section>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">
          By posting you agree to our <a href="/terms" className="underline">Terms</a> and confirm the item is legal to sell.
        </p>
        <SubmitButton className="btn-accent px-8 py-3 text-base" pendingText={listing ? "Saving…" : "Posting…"}>
          {listing ? "Save changes" : "Post my ad"}
        </SubmitButton>
      </div>
    </form>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="font-bold text-slate-900">{title}</h2>
      {hint && <p className="mt-0.5 text-sm text-slate-500">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function FieldError({ msg }: { msg?: string }) {
  return msg ? <p className="mt-1.5 text-sm text-red-600">{msg}</p> : null;
}
