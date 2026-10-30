import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Check, Store } from "lucide-react";
import { ContentPage } from "@/components/content-page";
import { getCurrentUser } from "@/lib/auth";
import { getViewer } from "@/lib/location";
import { formatDate, formatMoney, isBusiness, priceIn } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Plan } from "@/lib/types";
import { SubscribeForm } from "./subscribe";

export const metadata: Metadata = {
  title: "Business accounts",
  description: "Sell more on Pacific Listing with a business account: more ads, free bumps, no posting fees and a business badge.",
};

export default async function BusinessPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan: chosenId } = await searchParams;
  const current = await getCurrentUser();
  const supabase = await createClient();
  const [{ data }, { data: settings }] = await Promise.all([
    supabase.from("plans").select("*").eq("is_active", true).order("sort"),
    supabase.from("site_settings").select("card_payments_enabled").eq("id", 1).single(),
  ]);
  const plans = (data ?? []) as Plan[];
  const { currency } = await getViewer();
  const chosen = plans.find((p) => p.id === chosenId);
  const active = isBusiness(current?.profile?.business_until);

  return (
    <ContentPage title="Business accounts" intro="For car yards, agents, shops and anyone selling regularly. More ads, more visibility, a business badge.">
      {active && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-lagoon-200 bg-lagoon-50 p-4 text-sm text-lagoon-900">
          <BadgeCheck className="h-5 w-5 shrink-0" />
          <p>
            <strong>{current?.profile?.business_name}</strong> has an active business account until {formatDate(current!.profile!.business_until!)}. Renewing adds time to the end.
          </p>
        </div>
      )}
      <div className="grid gap-5 md:grid-cols-2">
        {plans.map((p, i) => {
          const price = priceIn(p.prices, currency);
          return (
            <div key={p.id} className={`card relative flex flex-col p-6 sm:p-7 ${i === plans.length - 1 ? "ring-2 ring-lagoon-500" : ""}`}>
              {i === plans.length - 1 && <span className="badge absolute -top-3 left-6 bg-lagoon-600 text-white">Most popular</span>}
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-lagoon-100 text-lagoon-700">
                <Store className="h-5 w-5" />
              </span>
              <h2 className="font-display mt-4 text-2xl font-bold">{p.name}</h2>
              <p className="mt-1 text-sm text-muted">{p.description}</p>
              <p className="mt-5">
                <span className="font-display text-4xl font-extrabold text-ink">{price == null ? "—" : formatMoney(price, currency)}</span>
                <span className="text-muted"> / {p.duration_days} days</span>
              </p>
              <ul className="mt-5 flex-1 space-y-2.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-ink-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-lagoon-600" /> {f}
                  </li>
                ))}
              </ul>
              <Link
                href={current ? `/business?plan=${p.id}#subscribe` : `/login?next=${encodeURIComponent(`/business?plan=${p.id}`)}`}
                className={`${i === plans.length - 1 ? "btn-accent" : "btn-secondary"} mt-6 w-full py-3`}
              >
                {active ? "Renew or switch" : "Choose"} {p.name.replace("Business ", "")}
              </Link>
            </div>
          );
        })}
      </div>
      {chosen && current && (
        <div id="subscribe" className="mt-8 scroll-mt-24">
          <SubscribeForm
            planId={chosen.id}
            planName={chosen.name}
            priceLabel={formatMoney(priceIn(chosen.prices, currency), currency)}
            cardEnabled={!!settings?.card_payments_enabled}
            defaultName={current.profile?.business_name ?? ""}
            currency={currency}
          />
        </div>
      )}
      <p className="mt-8 text-sm text-muted">
        Prices shown in {currency} for where you are. Change it with the currency button at the top of the page. Plans don&apos;t renew automatically; we&apos;ll remind you before yours ends. Questions?{" "}
        <Link href="/contact?subject=Advertising%20%26%20business" className="font-semibold text-lagoon-700 hover:underline">Talk to us</Link>.
      </p>
    </ContentPage>
  );
}
