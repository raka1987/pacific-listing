import { ImageResponse } from "next/og";

export const alt = "Pacific Listing — Buy, sell and discover across the Pacific";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "linear-gradient(135deg, #091c35 0%, #12325a 60%, #12857f 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: "#12857f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44 }}>
            🌊
          </div>
          <div style={{ fontSize: 44, fontWeight: 800 }}>Pacific Listing</div>
        </div>
        <div style={{ marginTop: 40, fontSize: 72, fontWeight: 800, lineHeight: 1.1, maxWidth: 900 }}>Buy, sell &amp; discover across the Pacific</div>
        <div style={{ marginTop: 28, fontSize: 32, color: "#a0ede2" }}>Free classifieds for Fiji, Samoa, Tonga, Vanuatu &amp; more</div>
      </div>
    ),
    size,
  );
}
