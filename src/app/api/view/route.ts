import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";

const BOTS = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|preview|headless|lighthouse|python|curl|wget/i;

/**
 * Counts one page view for the admin Traffic page. No cookies are used: a visitor is a
 * one-way code made from their connection and browser, which changes every day.
 */
export async function POST(request: NextRequest) {
  const ua = request.headers.get("user-agent") ?? "";
  if (!ua || BOTS.test(ua)) return new NextResponse(null, { status: 204 });

  let body: { path?: unknown; referrer?: unknown };
  try {
    body = JSON.parse(await request.text());
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const path = typeof body.path === "string" ? body.path.split("?")[0].slice(0, 200) : "";
  if (!path.startsWith("/") || path.startsWith("/admin")) return new NextResponse(null, { status: 204 });

  let referrer = "";
  if (typeof body.referrer === "string" && body.referrer) {
    try {
      const host = new URL(body.referrer).hostname.replace(/^www\.|^m\.|^l\.|^lm\./, "");
      if (!host.endsWith("pacificlisting.com") && host !== "localhost") referrer = host;
    } catch {}
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || "";
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "Pacific/Fiji" });
  const salt = process.env.VIEW_SALT || SUPABASE_ANON_KEY;
  const visitor = createHash("sha256").update(`${salt}|${day}|${ip}|${ua}`).digest("hex").slice(0, 32);
  const device = ua.includes("PacificListingApp") ? "app" : /Mobi|Android|iPhone|iPad/i.test(ua) ? "phone" : "computer";
  const country = request.headers.get("x-vercel-ip-country") ?? request.headers.get("cf-ipcountry") ?? "";

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  await supabase.rpc("track_view", { p_path: path, p_visitor: visitor, p_country: country, p_referrer: referrer, p_device: device });
  return new NextResponse(null, { status: 204 });
}
