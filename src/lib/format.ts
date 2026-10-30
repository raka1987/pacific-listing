import { countryByCode } from "./constants";
import type { PriceType } from "./types";

export function formatPrice(price: number | null, priceType: PriceType, countryCode: string) {
  if (priceType === "free") return "Free";
  if (priceType === "contact" || price == null) return "Contact for price";
  const currency = countryByCode(countryCode)?.currency ?? "USD";
  const amount = new Intl.NumberFormat("en", {
    maximumFractionDigits: price % 1 === 0 ? 0 : 2,
  }).format(price);
  return `${currency} ${amount}`;
}

export function formatMoney(amount: number | null | undefined, currency: string) {
  if (amount == null) return "—";
  const n = new Intl.NumberFormat("en", { maximumFractionDigits: amount % 1 === 0 ? 0 : 2, minimumFractionDigits: amount % 1 === 0 ? 0 : 2 }).format(amount);
  return `${currency} ${n}`;
}

export function priceIn(prices: Record<string, number> | null | undefined, currency: string) {
  const v = prices?.[currency];
  return v == null ? null : Number(v);
}

export function isBusiness(businessUntil: string | null | undefined) {
  return !!businessUntil && new Date(businessUntil) > new Date();
}

export function timeAgo(iso: string) {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  const units: [number, string][] = [
    [31536000, "year"],
    [2592000, "month"],
    [604800, "week"],
    [86400, "day"],
    [3600, "hour"],
    [60, "minute"],
  ];
  for (const [size, name] of units) {
    const n = Math.floor(seconds / size);
    if (n >= 1) return `${n} ${name}${n > 1 ? "s" : ""} ago`;
  }
  return "just now";
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function locationLabel(countryCode: string, city?: string | null) {
  const country = countryByCode(countryCode)?.name ?? countryCode;
  return city ? `${city}, ${country}` : country;
}

export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join("") || "?"
  );
}

/** Normalise a phone number for wa.me / tel: links. */
export function phoneDigits(phone: string) {
  return phone.replace(/[^\d+]/g, "").replace(/^\+/, "");
}
