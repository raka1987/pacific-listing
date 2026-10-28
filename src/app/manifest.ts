import type { MetadataRoute } from "next";
import { SITE } from "@/lib/constants";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: SITE.name,
    short_name: "Pacific Listing",
    description: SITE.description,
    start_url: "/?source=app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f7f9",
    theme_color: "#12857f",
    categories: ["shopping", "lifestyle", "business"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Post an ad", url: "/post", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Saved ads", url: "/favorites", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "My ads", url: "/my-ads", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
