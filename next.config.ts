import type { NextConfig } from "next";

// The site settings can be named either way in the host (e.g. Vercel):
// SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL, and so on. They are built into the
// pages under the NEXT_PUBLIC_ names the code reads. These values are safe to
// be public; the database's security rules protect the data.
const pick = (...names: string[]) => names.map((n) => process.env[n]).find((v) => v && v.trim()) ?? "";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: pick("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: pick("SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    NEXT_PUBLIC_SITE_URL: pick("SITE_URL", "NEXT_PUBLIC_SITE_URL"),
    NEXT_PUBLIC_SUPPORT_EMAIL: pick("SUPPORT_EMAIL", "NEXT_PUBLIC_SUPPORT_EMAIL"),
    // Optional marketing tools; each switches on when its ID is set in the host.
    NEXT_PUBLIC_GA_ID: pick("GA_MEASUREMENT_ID", "NEXT_PUBLIC_GA_ID"),
    NEXT_PUBLIC_META_PIXEL_ID: pick("META_PIXEL_ID", "NEXT_PUBLIC_META_PIXEL_ID"),
  },
};

export default nextConfig;
