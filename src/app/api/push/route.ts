import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { sendPush } from "@/lib/fcm";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";

/** Called by the database (never by browsers) to send a phone notification. */
export async function POST(request: NextRequest) {
  const secret = process.env.PUSH_SECRET?.trim() ?? "";
  const given = request.headers.get("x-push-secret") ?? "";
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }
  let body: { tokens?: unknown; title?: unknown; body?: unknown; url?: unknown; tag?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const tokens = Array.isArray(body.tokens) ? body.tokens.filter((t): t is string => typeof t === "string").slice(0, 20) : [];
  if (!tokens.length || typeof body.title !== "string") return NextResponse.json({ sent: 0 });
  try {
    const { sent, dead } = await sendPush(tokens, {
      title: body.title.slice(0, 100),
      body: typeof body.body === "string" ? body.body.slice(0, 240) : "",
      url: typeof body.url === "string" && body.url.startsWith("/") ? body.url : "/",
      tag: typeof body.tag === "string" ? body.tag.slice(0, 64) : undefined,
    });
    if (dead.length) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
      await supabase.rpc("remove_dead_push_tokens", { p_secret: secret, p_tokens: dead });
    }
    return NextResponse.json({ sent, removed: dead.length });
  } catch (e) {
    console.error("Push error", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
