// Rough map positions (latitude, longitude) of towns and suburbs, for "within X km" searches.
// Ads only store a town name, so a distance search looks for ads in every known place nearby.
// Distances are straight-line, so across the sea they can be shorter than the trip.
const PLACES: Record<string, Record<string, [number, number]>> = {
  FJ: {
    Suva: [-18.1416, 178.4419], Lami: [-18.1167, 178.4167], Tamavua: [-18.11, 178.45], Samabula: [-18.125, 178.46],
    Nabua: [-18.12, 178.45], Raiwaqa: [-18.12, 178.455], Valelevu: [-18.07, 178.49], Nasinu: [-18.0667, 178.5167],
    Nakasi: [-18.05, 178.5], Nausori: [-18.0333, 178.5333], Navua: [-18.2167, 178.1667], "Pacific Harbour": [-18.25, 178.05],
    Korovou: [-17.8, 178.5333], Korolevu: [-18.2167, 177.7333], Sigatoka: [-18.1416, 177.5083], Nadi: [-17.8, 177.4167],
    Namaka: [-17.77, 177.43], Denarau: [-17.77, 177.38], Lautoka: [-17.6167, 177.45], Ba: [-17.5333, 177.6667],
    Tavua: [-17.45, 177.8667], Vatukoula: [-17.5, 177.85], Rakiraki: [-17.3667, 178.1667], Levuka: [-17.6833, 178.8333],
    Labasa: [-16.4167, 179.3833], Savusavu: [-16.7833, 179.3333], Seaqaqa: [-16.5, 179.15], Taveuni: [-16.7667, -179.9667],
  },
  WS: {
    Apia: [-13.8333, -171.7667], Vaitele: [-13.82, -171.81], Faleolo: [-13.83, -172.0], Mulifanua: [-13.83, -172.03],
    Siumu: [-14.0, -171.77], Lalomanu: [-14.06, -171.43], Salelologa: [-13.73, -172.2], Asau: [-13.52, -172.63],
  },
  TO: {
    "Nuku'alofa": [-21.1394, -175.2042], "Fua'amotu": [-21.24, -175.15], "Mu'a": [-21.18, -175.12], Kolovai: [-21.1, -175.33],
    "'Ohonua": [-21.33, -174.95], Pangai: [-19.8, -174.35], Neiafu: [-18.65, -173.98],
  },
  VU: {
    "Port Vila": [-17.7333, 168.3167], Mele: [-17.7, 168.27], Luganville: [-15.5333, 167.1667], Norsup: [-16.07, 167.38],
    Lakatoro: [-16.1, 167.42], Lenakel: [-19.53, 169.27], Isangel: [-19.54, 169.27],
  },
  SB: {
    Honiara: [-9.4333, 159.95], Tulagi: [-9.1, 160.15], Auki: [-8.7667, 160.7], Noro: [-8.24, 157.2], Munda: [-8.33, 157.26],
    Gizo: [-8.1, 156.8333], Kirakira: [-10.45, 161.92],
  },
  PG: {
    "Port Moresby": [-9.4431, 147.1797], Lae: [-6.7333, 147.0], Goroka: [-6.0833, 145.3833], Kundiawa: [-6.0167, 144.9667],
    "Mount Hagen": [-5.8667, 144.2167], Mendi: [-6.15, 143.65], Wabag: [-5.4833, 143.7167], Madang: [-5.2167, 145.8],
    Wewak: [-3.55, 143.6333], Vanimo: [-2.6833, 141.3], Kokopo: [-4.35, 152.2667], Rabaul: [-4.2, 152.1833],
    Kimbe: [-5.55, 150.15], Kavieng: [-2.5667, 150.8], Lorengau: [-2.0167, 147.2667], Alotau: [-10.3167, 150.4333],
    Popondetta: [-8.7667, 148.2333], Daru: [-9.0833, 143.2], Arawa: [-6.2167, 155.5333], Buka: [-5.4167, 154.6667],
  },
  KI: { "South Tarawa": [1.3278, 172.9783], Betio: [1.35, 172.93], Bairiki: [1.33, 172.98], Bikenibeu: [1.36, 173.12] },
  TV: { Funafuti: [-8.52, 179.2] },
  NR: { Yaren: [-0.55, 166.92] },
  CK: { Avarua: [-21.2, -159.77], Arorangi: [-21.22, -159.82], Muri: [-21.25, -159.73], Aitutaki: [-18.86, -159.79] },
  NU: { Alofi: [-19.05, -169.92] },
  NC: { "Nouméa": [-22.2758, 166.458], "Dumbéa": [-22.15, 166.45], "Mont-Dore": [-22.27, 166.57], "Païta": [-22.13, 166.37], "Koné": [-21.06, 164.86] },
  PF: { Papeete: [-17.535, -149.5696], "Faa'a": [-17.55, -149.6], Punaauia: [-17.63, -149.6], Pirae: [-17.53, -149.55], Moorea: [-17.55, -149.79], "Bora Bora": [-16.5, -151.75] },
  AS: { "Pago Pago": [-14.2781, -170.7025], Tafuna: [-14.33, -170.72], Leone: [-14.34, -170.78] },
  MH: { Majuro: [7.0897, 171.3803], Ebeye: [8.78, 167.74] },
  FM: { Kolonia: [6.9639, 158.2081], Palikir: [6.92, 158.16], Weno: [7.45, 151.85], Tofol: [5.33, 163.0], Colonia: [9.51, 138.12] },
  PW: { Koror: [7.34, 134.48], Airai: [7.37, 134.56], Melekeok: [7.5, 134.63] },
  GU: { "Hagåtña": [13.4757, 144.7489], Tamuning: [13.49, 144.78], Dededo: [13.52, 144.84], Yigo: [13.54, 144.89], Mangilao: [13.45, 144.8], "Santa Rita": [13.39, 144.67] },
};

export const DISTANCES = [10, 25, 50, 100, 200, 300] as const;

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, "'").trim().toLowerCase();

function km([a, b]: [number, number], [c, d]: [number, number]) {
  const r = Math.PI / 180;
  const x = Math.sin(((c - a) * r) / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(((d - b) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(x));
}

/** Every place we know in a country: the main towns first, then the rest A to Z. */
export function placeNames(country: string, mainTowns: string[] = []) {
  const rest = Object.keys(PLACES[country] ?? {})
    .filter((p) => !mainTowns.includes(p))
    .sort((a, b) => a.localeCompare(b));
  return [...mainTowns, ...rest];
}

/** The known place matching a typed town, e.g. "suva" -> "Suva" in Fiji. */
export function findPlace(country: string | undefined, town: string | undefined) {
  if (!country || !town) return null;
  const places = PLACES[country];
  if (!places) return null;
  const name = Object.keys(places).find((p) => norm(p) === norm(town));
  return name ? { name, at: places[name] } : null;
}

/** Every known place within `radius` km of a town (the town itself first), or null if the town isn't known. */
export function placesNear(country: string | undefined, town: string | undefined, radius: number) {
  const here = findPlace(country, town);
  if (!here || !country) return null;
  return Object.entries(PLACES[country])
    .map(([name, at]) => ({ name, d: km(here.at, at) }))
    .filter((p) => p.d <= radius)
    .sort((a, b) => a.d - b.d)
    .map((p) => p.name);
}
