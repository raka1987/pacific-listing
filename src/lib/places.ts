import { COUNTRIES, type Country } from "./constants";

// Web addresses and main towns for each country, used by the search landing
// pages (e.g. /fiji/vehicles/utes or /samoa/apia).

const SLUGS: Record<string, string> = {
  FJ: "fiji", WS: "samoa", TO: "tonga", VU: "vanuatu", SB: "solomon-islands", PG: "papua-new-guinea",
  KI: "kiribati", TV: "tuvalu", NR: "nauru", CK: "cook-islands", NU: "niue", NC: "new-caledonia",
  PF: "french-polynesia", AS: "american-samoa", MH: "marshall-islands", FM: "micronesia", PW: "palau", GU: "guam",
};

export const TOWNS: Record<string, string[]> = {
  FJ: ["Suva", "Nadi", "Lautoka", "Nausori", "Labasa", "Ba", "Sigatoka", "Savusavu"],
  WS: ["Apia", "Salelologa", "Vaitele"],
  TO: ["Nuku'alofa", "Neiafu", "Pangai"],
  VU: ["Port Vila", "Luganville"],
  SB: ["Honiara", "Gizo", "Auki"],
  PG: ["Port Moresby", "Lae", "Mount Hagen", "Madang", "Kokopo"],
  KI: ["South Tarawa", "Betio"],
  TV: ["Funafuti"],
  NR: ["Yaren"],
  CK: ["Avarua"],
  NU: ["Alofi"],
  NC: ["Nouméa"],
  PF: ["Papeete"],
  AS: ["Pago Pago"],
  MH: ["Majuro"],
  FM: ["Kolonia", "Weno"],
  PW: ["Koror"],
  GU: ["Hagåtña", "Tamuning", "Dededo"],
};

export const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const countrySlug = (code: string) => SLUGS[code];
export const countryFromSlug = (slug: string): Country | undefined =>
  COUNTRIES.find((c) => SLUGS[c.code] === slug);

export const townFromSlug = (countryCode: string, slug: string) => TOWNS[countryCode]?.find((t) => slugify(t) === slug);

/** Address of a landing page, e.g. landingPath("FJ", "vehicles", "utes") -> /fiji/vehicles/utes */
export function landingPath(countryCode: string, ...rest: (string | undefined | null)[]) {
  return ["", SLUGS[countryCode], ...rest.filter(Boolean)].join("/");
}
