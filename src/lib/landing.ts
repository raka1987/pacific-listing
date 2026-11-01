import { categoryBySlug, countryByCode, type Category, type Subcategory } from "./constants";
import { countryFromSlug, TOWNS, townFromSlug } from "./places";

export type Landing = {
  country: NonNullable<ReturnType<typeof countryByCode>>;
  category?: Category;
  sub?: Subcategory;
  town?: string;
};

/** Works out what /fiji, /fiji/vehicles, /fiji/vehicles/utes or /fiji/suva refers to. */
export function resolveLanding(countrySlug: string, path: string[] = []): Landing | null {
  const country = countryFromSlug(countrySlug);
  if (!country) return null;
  if (path.length === 0) return { country };
  if (path.length > 2) return null;
  const category = categoryBySlug(path[0]);
  if (category) {
    if (path.length === 1) return { country, category };
    const sub = category.subcategories.find((s) => s.slug === path[1]);
    return sub ? { country, category, sub } : null;
  }
  const town = path.length === 1 ? townFromSlug(country.code, path[0]) : undefined;
  return town ? { country, town } : null;
}

const SALE_WORDING: Record<string, string> = {
  vehicles: "Vehicles for sale",
  property: "Property for sale and rent",
  electronics: "Electronics for sale",
  "home-garden": "Home & furniture for sale",
  fashion: "Clothes & fashion for sale",
  jobs: "Jobs",
  services: "Local services",
  pets: "Pets & animals",
  boats: "Boats & marine for sale",
  "lost-found": "Lost & found",
};

/** "Utes & pickups for sale", "Property for rent", "Full-time jobs" */
export function landingSubject(l: Pick<Landing, "category" | "sub">) {
  if (!l.category) return "Buy and sell";
  if (!l.sub) return SALE_WORDING[l.category.slug] ?? l.category.name;
  const c = l.category.slug;
  if (c === "property") {
    const words: Record<string, string> = {
      "for-sale": "Property for sale",
      "for-rent": "Property for rent",
      commercial: "Commercial property",
    };
    return words[l.sub.slug] ?? l.sub.name;
  }
  if (c === "jobs") return `${l.sub.name} jobs`;
  if (c === "services") return `${l.sub.name} services`;
  if (c === "lost-found" || (c === "pets" && ["supplies", "other"].includes(l.sub.slug))) return l.sub.name;
  if (["vehicles", "electronics", "home-garden", "fashion", "boats", "pets"].includes(c)) return `${l.sub.name} for sale`;
  return l.sub.name;
}

export function landingTitle(l: Landing) {
  const where = l.town ? `${l.town}, ${l.country.name}` : l.country.name;
  return `${landingSubject(l)} in ${where}`;
}

export function landingDescription(l: Landing, count: number) {
  const where = l.town ? `${l.town}, ${l.country.name}` : l.country.name;
  const towns = (TOWNS[l.country.code] ?? []).slice(0, 3).join(", ");
  const what = landingSubject(l).toLowerCase();
  const n = count > 0 ? `${count.toLocaleString()} ${count === 1 ? "ad" : "ads"} for ` : "";
  return `Browse ${n}${what} in ${where} on Pacific Listing${towns && !l.town ? `, from ${towns} and across the islands` : ""}. Contact sellers directly by phone or WhatsApp, or post your own ad free.`;
}

