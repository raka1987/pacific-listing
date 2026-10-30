import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES: EmailOtpType[] = ["signup", "email", "recovery", "invite", "magiclink", "email_change"];

// Handles email confirmation and password reset links from Supabase.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next") ?? "/";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";
  const go = (path: string) => NextResponse.redirect(`${origin}${path}`);
  const supabase = await createClient();

  // Links from the email templates (token_hash): work in any browser or on any device.
  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return go(type === "recovery" ? "/forgot-password?error=link" : "/login?error=link");
    if (type === "recovery") return go("/update-password");
    if (type === "signup" || type === "email") return go(`${next}${next.includes("?") ? "&" : "?"}welcome=1`);
    return go(next);
  }

  // Older style links (code): only work in the browser the person signed up in.
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return go(next);
    // Supabase only hands out a code after checking the email, so the account is confirmed;
    // the link was just opened in another app or device. They can log in normally.
    if (next === "/update-password") return go("/forgot-password?error=browser");
    return go(`/login?confirmed=1&next=${encodeURIComponent(next)}`);
  }

  return go(next === "/update-password" ? "/forgot-password?error=link" : "/login?error=link");
}
