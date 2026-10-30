export const SITE = {
  name: "Pacific Listing",
  tagline: "Buy, sell and discover across the Pacific",
  description:
    "Pacific Listing is the free marketplace for Fiji, Samoa, Tonga, Vanuatu and the wider Pacific. Buy and sell vehicles, property, electronics, find jobs, services and more.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@pacificlisting.com",
};

export type Category = {
  slug: string;
  name: string;
  icon: string; // lucide icon name, see components/category-icon.tsx
  color: string; // tailwind classes for the icon tile
  hasCondition: boolean;
};

export const CATEGORIES: Category[] = [
  { slug: "vehicles", name: "Vehicles", icon: "car", color: "bg-sky-100 text-sky-700", hasCondition: true },
  { slug: "property", name: "Property", icon: "home", color: "bg-emerald-100 text-emerald-700", hasCondition: false },
  { slug: "electronics", name: "Electronics", icon: "smartphone", color: "bg-violet-100 text-violet-700", hasCondition: true },
  { slug: "home-garden", name: "Home & Furniture", icon: "sofa", color: "bg-amber-100 text-amber-700", hasCondition: true },
  { slug: "fashion", name: "Fashion", icon: "shirt", color: "bg-pink-100 text-pink-700", hasCondition: true },
  { slug: "jobs", name: "Jobs", icon: "briefcase", color: "bg-indigo-100 text-indigo-700", hasCondition: false },
  { slug: "services", name: "Services", icon: "wrench", color: "bg-orange-100 text-orange-700", hasCondition: false },
  { slug: "pets", name: "Pets & Animals", icon: "paw", color: "bg-lime-100 text-lime-700", hasCondition: false },
  { slug: "boats", name: "Boats & Marine", icon: "sailboat", color: "bg-cyan-100 text-cyan-700", hasCondition: true },
  { slug: "lost-found", name: "Lost & Found", icon: "search", color: "bg-rose-100 text-rose-700", hasCondition: false },
];

export const categoryBySlug = (slug?: string | null) => CATEGORIES.find((c) => c.slug === slug);

export type Country = { code: string; name: string; currency: string; flag: string };

export const COUNTRIES: Country[] = [
  { code: "FJ", name: "Fiji", currency: "FJD", flag: "🇫🇯" },
  { code: "WS", name: "Samoa", currency: "WST", flag: "🇼🇸" },
  { code: "TO", name: "Tonga", currency: "TOP", flag: "🇹🇴" },
  { code: "VU", name: "Vanuatu", currency: "VUV", flag: "🇻🇺" },
  { code: "SB", name: "Solomon Islands", currency: "SBD", flag: "🇸🇧" },
  { code: "PG", name: "Papua New Guinea", currency: "PGK", flag: "🇵🇬" },
  { code: "KI", name: "Kiribati", currency: "AUD", flag: "🇰🇮" },
  { code: "TV", name: "Tuvalu", currency: "AUD", flag: "🇹🇻" },
  { code: "NR", name: "Nauru", currency: "AUD", flag: "🇳🇷" },
  { code: "CK", name: "Cook Islands", currency: "NZD", flag: "🇨🇰" },
  { code: "NU", name: "Niue", currency: "NZD", flag: "🇳🇺" },
  { code: "NC", name: "New Caledonia", currency: "XPF", flag: "🇳🇨" },
  { code: "PF", name: "French Polynesia", currency: "XPF", flag: "🇵🇫" },
  { code: "AS", name: "American Samoa", currency: "USD", flag: "🇦🇸" },
  { code: "MH", name: "Marshall Islands", currency: "USD", flag: "🇲🇭" },
  { code: "FM", name: "Micronesia", currency: "USD", flag: "🇫🇲" },
  { code: "PW", name: "Palau", currency: "USD", flag: "🇵🇼" },
  { code: "GU", name: "Guam", currency: "USD", flag: "🇬🇺" },
];

export const countryByCode = (code?: string | null) => COUNTRIES.find((c) => c.code === code);

export const REPORT_REASONS = [
  "Scam or fraud",
  "Prohibited item",
  "Wrong category",
  "Duplicate listing",
  "Offensive content",
  "Item already sold",
  "Other",
];

export const CURRENCIES = ["FJD", "WST", "TOP", "VUV", "SBD", "PGK", "AUD", "NZD", "XPF", "USD"] as const;

/** Approximate value of 1 FJD, used only to suggest prices in other currencies. */
export const FJD_RATES: Record<string, number> = {
  FJD: 1, WST: 1.2, TOP: 1.05, VUV: 53, SBD: 3.7, PGK: 1.7, AUD: 0.68, NZD: 0.74, XPF: 50, USD: 0.44,
};

export const currencyFor = (countryCode?: string | null) => countryByCode(countryCode ?? "FJ")?.currency ?? "FJD";

export const PAYMENT_METHODS = {
  mpaisa: "M-PAiSA",
  mycash: "MyCash",
  bank: "Bank transfer",
  card: "Card",
  cash: "Cash",
  invoice: "Invoice",
  free: "Included in plan",
} as const;

export const ORDER_KINDS = {
  boost: "Promotion",
  subscription: "Business account",
  campaign: "Banner advertising",
  posting_fee: "Posting fee",
} as const;

export const ROLES = {
  user: "Member",
  moderator: "Moderator",
  sales: "Sales",
  admin: "Admin",
} as const;

export const ROLE_DESCRIPTIONS = {
  user: "Can post and manage their own ads.",
  moderator: "Approves ads, handles reports, messages and the notice board. Can't see money.",
  sales: "Manages payments, promotions, banner advertising and business accounts.",
  admin: "Full access, including users, staff roles and settings.",
} as const;

export const PAGE_SIZE = 24;
export const MAX_IMAGES = 8;
export const IMAGE_BUCKET = "listing-images";
