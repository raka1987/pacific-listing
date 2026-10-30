import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";
import { formatPrice, locationLabel } from "@/lib/format";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigProblem } from "@/lib/supabase/env";

// The preview card shown when an ad is shared on Facebook, WhatsApp and others.
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="11" fill="#12857f"/><path d="M7 24c3.2 0 3.2-3 6.5-3s3.3 3 6.5 3 3.3-3 6.5-3 3.3 3 6.5 3" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><path d="M7 30c3.2 0 3.2-3 6.5-3s3.3 3 6.5 3 3.3-3 6.5-3 3.3 3 6.5 3" fill="none" stroke="#a0ede2" stroke-width="2.6" stroke-linecap="round"/><circle cx="27" cy="13" r="4.5" fill="#ff8a6b"/></svg>`;
const LOGO = `data:image/svg+xml;base64,${Buffer.from(LOGO_SVG).toString("base64")}`;
export const alt = "Ad on Pacific Listing";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Row = { title: string; price: number | null; price_type: "fixed" | "negotiable" | "free" | "contact"; country: string; city: string | null; images: string[]; status: string };

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let ad: Row | null = null;
  if (!supabaseConfigProblem() && /^[0-9a-f-]{36}$/i.test(id)) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data } = await supabase.from("listings").select("title, price, price_type, country, city, images, status").eq("id", id).maybeSingle<Row>();
    ad = data;
  }
  const photo = ad?.images?.[0];
  const price = ad ? formatPrice(ad.price, ad.price_type, ad.country) : "";
  const where = ad ? locationLabel(ad.country, ad.city) : "";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#0d2747", fontFamily: "sans-serif" }}>
        {photo ? (
          <img src={photo} alt="" width={700} height={630} style={{ width: 700, height: 630, objectFit: "cover" }} />
        ) : (
          <div style={{ width: 700, height: 630, display: "flex", alignItems: "center", justifyContent: "center", background: "#12857f" }}>
            <img src={LOGO} alt="" width={220} height={220} />
          </div>
        )}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "56px 48px", color: "#fff" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {ad?.status === "sold" && (
              <div style={{ display: "flex", alignSelf: "flex-start", background: "#ff6a45", borderRadius: 999, padding: "6px 18px", fontSize: 24, fontWeight: 700, marginBottom: 20 }}>
                SOLD
              </div>
            )}
            <div style={{ display: "flex", fontSize: 58, fontWeight: 800, color: "#66dccf", lineHeight: 1.05 }}>{price || "Pacific Listing"}</div>
            <div style={{ fontSize: 36, fontWeight: 600, marginTop: 20, lineHeight: 1.2, display: "flex" }}>
              {(ad?.title ?? "Buy and sell across the Pacific").slice(0, 70)}
            </div>
            {where && <div style={{ display: "flex", fontSize: 26, marginTop: 18, color: "rgba(255,255,255,0.75)" }}>{where}</div>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <img src={LOGO} alt="" width={52} height={52} />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 28, fontWeight: 700 }}>Pacific Listing</div>
              <div style={{ fontSize: 20, color: "rgba(255,255,255,0.7)" }}>pacificlisting.com</div>
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
