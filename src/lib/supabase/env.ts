// The two Supabase settings, tidied up (stray spaces, quotes or a trailing
// slash pasted along with them are common), plus a plain-English check.
const clean = (v: string | undefined) => (v ?? "").trim().replace(/^["']|["']$/g, "").trim();

export const SUPABASE_URL = clean(process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/+$/, "");
export const SUPABASE_ANON_KEY = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/** Returns what's wrong with the settings, or null when they look right. */
export function supabaseConfigProblem(): string | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return "NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY are missing.";
  }
  let url: URL;
  try {
    url = new URL(SUPABASE_URL);
  } catch {
    return `NEXT_PUBLIC_SUPABASE_URL isn't a web address. It is "${SUPABASE_URL}" but should look like https://abcd1234.supabase.co`;
  }
  const local = url.hostname === "127.0.0.1" || url.hostname === "localhost";
  if (!local && url.protocol !== "https:") {
    return `NEXT_PUBLIC_SUPABASE_URL must start with https:// (it is "${SUPABASE_URL}").`;
  }
  if (!local && (url.hostname.endsWith("supabase.com") || url.pathname !== "/")) {
    return `NEXT_PUBLIC_SUPABASE_URL should be just the Project URL, like https://abcd1234.supabase.co. It is "${SUPABASE_URL}". Copy "Project URL" from Supabase > Project Settings > API (not the address in your browser bar).`;
  }
  if (/^sb_secret_/.test(SUPABASE_ANON_KEY) || /service_role/.test(decodeRole(SUPABASE_ANON_KEY))) {
    return "NEXT_PUBLIC_SUPABASE_ANON_KEY is the SECRET (service_role) key. Replace it with the anon public / publishable key, and keep the secret key private.";
  }
  if (!/^(eyJ|sb_publishable_)/.test(SUPABASE_ANON_KEY)) {
    return "NEXT_PUBLIC_SUPABASE_ANON_KEY doesn't look right. It should start with eyJ (anon public key) or sb_publishable_ (publishable key).";
  }
  return null;
}

function decodeRole(key: string) {
  try {
    return atob(key.split(".")[1]?.replace(/-/g, "+").replace(/_/g, "/") ?? "");
  } catch {
    return "";
  }
}
