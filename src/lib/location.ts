import { cache } from "react";
import { cookies, headers } from "next/headers";
import { COUNTRIES, FJD_RATES } from "./constants";

export const COUNTRY_COOKIE = "pl_country";

/** Places a visitor can be: the Pacific countries plus where many islanders live abroad. */
export const VIEWER_REGIONS = [
  ...COUNTRIES,
  { code: "NZ", name: "New Zealand", currency: "NZD", flag: "🇳🇿" },
  { code: "AU", name: "Australia", currency: "AUD", flag: "🇦🇺" },
  { code: "US", name: "United States", currency: "USD", flag: "🇺🇸" },
];

export const regionByCode = (code?: string | null) => VIEWER_REGIONS.find((r) => r.code === code);

/**
 * The visitor's country: their own choice (saved in a cookie) first, then
 * the country their connection comes from (set by the host, e.g. Vercel).
 */
export const getViewer = cache(async () => {
  const chosen = (await cookies()).get(COUNTRY_COOKIE)?.value;
  const h = await headers();
  const detected = (h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry") ?? "").toUpperCase();
  const region = regionByCode(chosen) ?? regionByCode(detected);
  return {
    country: region?.code ?? null,
    /** Set only when the visitor is in a Pacific country we list ads for. */
    pacificCountry: region && COUNTRIES.some((c) => c.code === region.code) ? region.code : null,
    currency: region?.currency ?? "FJD",
    flag: region?.flag ?? "🌏",
    name: region?.name ?? "Pacific",
    chosen: !!regionByCode(chosen),
  };
});

/** Approximate conversion between two currencies, via Fiji dollars. */
export function convert(amount: number, from: string, to: string) {
  const a = FJD_RATES[from];
  const b = FJD_RATES[to];
  if (!a || !b) return null;
  const v = (amount / a) * b;
  return v >= 1000 ? Math.round(v / 10) * 10 : Math.round(v);
}
