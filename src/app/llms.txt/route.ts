import { CATEGORIES, COUNTRIES, SITE } from "@/lib/constants";
import { landingPath } from "@/lib/places";

export const revalidate = 86400;

// A plain-language guide to the site for AI assistants (see llmstxt.org).
export function GET() {
  const u = (p: string) => `${SITE.url}${p}`;
  const text = `# ${SITE.name}

> ${SITE.name} is a free online marketplace for the Pacific Islands. People buy and sell vehicles, property (for sale and rent), electronics, furniture, clothes, boats, sports gear and pets, find jobs, local services, tours and activities, and post lost & found notices. Sellers are contacted directly by phone or WhatsApp. Prices are shown in each country's own currency.

Countries covered: ${COUNTRIES.map((c) => c.name).join(", ")}.

## Main pages
- [Home](${u("/")}): latest and featured ads
- [Search all ads](${u("/search")}): search by keyword, category, type, country, town and price
- [Post an ad](${u("/sell")}): how to sell on ${SITE.name} (posting is free)
- [Safety tips](${u("/safety")}): how to buy and sell safely
- [Business accounts](${u("/business")}): plans for dealers, agents and shops
- [Advertise](${u("/advertise")}): banner advertising for businesses, by country or across the Pacific
- [Contact](${u("/contact")})

## Browse by country
${COUNTRIES.map((c) => `- [${c.name}](${u(landingPath(c.code))})`).join("\n")}

## Browse by category (example: Fiji)
${CATEGORIES.map((c) => `- [${c.name} in Fiji](${u(landingPath("FJ", c.slug))})${c.subcategories.length ? `: ${c.subcategories.map((s) => s.name).join(", ")}` : ""}`).join("\n")}

Addresses follow the pattern ${SITE.url}/<country>/<category>/<type>, for example ${u(landingPath("WS", "property", "for-rent"))} for property for rent in Samoa, or ${SITE.url}/<country>/<town>, for example ${u("/fiji/suva")}.

## Notes
- Every ad page shows its price, location, photos, condition and the seller's contact options.
- Contact ${SITE.supportEmail} for anything else.
`;
  return new Response(text, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
