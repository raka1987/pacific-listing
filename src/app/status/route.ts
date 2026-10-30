import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigProblem } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

// A plain-text connection check for the site owner: open /status.
// Shows only public information (the project address and the kind of key).
export async function GET() {
  const lines: string[] = ["Pacific Listing connection check", ""];
  const keyKind = SUPABASE_ANON_KEY.startsWith("sb_publishable_")
    ? "publishable key"
    : SUPABASE_ANON_KEY.startsWith("eyJ")
      ? "anon public key"
      : SUPABASE_ANON_KEY
        ? "unrecognised key"
        : "missing";
  lines.push(`SUPABASE_URL:      ${SUPABASE_URL || "(missing)"}`);
  lines.push(`SUPABASE_ANON_KEY: ${keyKind}`);

  const problem = supabaseConfigProblem();
  if (problem) {
    lines.push("", `PROBLEM: ${problem}`);
    return text(lines);
  }

  const check = async (label: string, path: string) => {
    const started = Date.now();
    try {
      const res = await fetch(`${SUPABASE_URL}${path}`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      const body = (await res.text()).slice(0, 160).replace(/\s+/g, " ");
      return { ok: res.ok, line: `${label}: HTTP ${res.status} in ${Date.now() - started} ms${res.ok ? "" : ` (${body})`}`, status: res.status };
    } catch (e) {
      const err = e as Error & { cause?: { code?: string; message?: string } };
      return { ok: false, line: `${label}: could not connect (${err.cause?.code ?? err.cause?.message ?? err.message})`, status: 0 };
    }
  };

  const auth = await check("Login service", "/auth/v1/health");
  const db = await check("Database tables", "/rest/v1/plans?select=name&limit=1");
  lines.push("", auth.line, db.line, "");

  if (auth.status === 0) {
    lines.push(
      "PROBLEM: The site can't reach this address at all. Check SUPABASE_URL is exactly the",
      "Project URL from Supabase > Project Settings > API (for example https://abcd1234.supabase.co),",
      "with no typos, and that the project isn't paused. Then redeploy in Vercel.",
    );
  } else if (auth.status === 401 || db.status === 401) {
    lines.push("PROBLEM: Supabase rejected the key. Copy the anon public (or publishable) key again from", "Supabase > Project Settings > API, update SUPABASE_ANON_KEY in Vercel, then redeploy.");
  } else if (db.status === 404 || (db.status >= 400 && /does not exist|schema cache/i.test(db.line))) {
    lines.push("PROBLEM: Connected, but the tables aren't there. Run supabase/setup.sql in the Supabase SQL Editor.");
  } else if (auth.ok && db.ok) {
    lines.push("ALL GOOD: the site is connected to Supabase.");
  } else {
    lines.push("Something unexpected happened. Send this page to your developer.");
  }
  return text(lines);
}

function text(lines: string[]) {
  return new Response(lines.join("\n") + "\n", { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}
