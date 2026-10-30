"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { COUNTRIES, HEARD_FROM, SITE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; message?: string; values?: Record<string, string>; unconfirmed?: boolean };

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

// "fetch failed" means the server couldn't reach Supabase at all; say so plainly.
const CONNECTION_ERROR = "We couldn't reach the database just now. If you run this site, open /status to see what's wrong.";
// Typed values (not passwords) sent back with an error so the form keeps them.
const typed = (fd: FormData) =>
  Object.fromEntries([...fd.entries()].filter(([k, v]) => typeof v === "string" && k !== "password")) as Record<string, string>;

const friendly = (message: string) => (/fetch failed|network|ENOTFOUND|ECONNREFUSED/i.test(message) ? CONNECTION_ERROR : message);

function safeNext(next: string) {
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : SITE.url;
}

export async function login(_: AuthState, fd: FormData): Promise<AuthState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: str(fd, "email"), password: String(fd.get("password") ?? "") });
  if (error) {
    if (friendly(error.message) === CONNECTION_ERROR) return { error: CONNECTION_ERROR, values: typed(fd) };
    if (error.code === "email_not_confirmed" || error.message === "Email not confirmed") {
      return { error: "Please confirm your email first: check your inbox (and spam folder), or send a new link below.", values: typed(fd), unconfirmed: true };
    }
    return { error: "Wrong email or password.", values: typed(fd) };
  }
  redirect(safeNext(str(fd, "next")));
}

export async function signup(_: AuthState, fd: FormData): Promise<AuthState> {
  const full_name = str(fd, "full_name");
  const email = str(fd, "email");
  const password = String(fd.get("password") ?? "");
  const country = str(fd, "country");
  if (full_name.length < 2) return { error: "Please enter your name.", values: typed(fd) };
  if (password.length < 8) return { error: "Password must be at least 8 characters.", values: typed(fd) };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name,
        country: COUNTRIES.some((c) => c.code === country) ? country : null,
        phone: str(fd, "phone") || null,
        heard_from: HEARD_FROM.includes(str(fd, "heard_from")) ? str(fd, "heard_from") : null,
      },
      emailRedirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(safeNext(str(fd, "next")))}`,
    },
  });
  // Supabase doesn't say outright when an email is taken (so it can't be used to look up members);
  // it returns a user with no logins attached instead, and sends no email.
  const taken = /already registered|already exists/i.test(error?.message ?? "") || (!!data?.user && data.user.identities?.length === 0);
  if (taken) {
    return { error: "This email already has an account. Log in instead, or use \"Forgot password\" if you can't remember it.", values: typed(fd) };
  }
  if (error) return { error: friendly(error.message), values: typed(fd) };
  if (!data.session) return { message: `We've sent a confirmation link to ${email}. Click it to activate your account.` };
  const next = safeNext(str(fd, "next"));
  redirect(`${next}${next.includes("?") ? "&" : "?"}welcome=1`);
}

export async function resendConfirmation(_: AuthState, fd: FormData): Promise<AuthState> {
  const email = str(fd, "email");
  if (!email.includes("@")) return { error: "Enter your email address first.", values: typed(fd), unconfirmed: true };
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(safeNext(str(fd, "next")))}` },
  });
  if (error) {
    const wait = /security purposes|rate limit|after \d+ seconds/i.test(error.message);
    return { error: wait ? "Please wait a minute before asking for another link." : friendly(error.message), values: typed(fd), unconfirmed: true };
  }
  return { message: `We've sent a new confirmation link to ${email}.`, values: typed(fd) };
}

export async function requestPasswordReset(_: AuthState, fd: FormData): Promise<AuthState> {
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(str(fd, "email"), {
    redirectTo: `${await origin()}/auth/callback?next=/update-password`,
  });
  return { message: "If an account exists for that email, we've sent a link to reset your password." };
}

export async function updatePassword(_: AuthState, fd: FormData): Promise<AuthState> {
  const password = String(fd.get("password") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: friendly(error.message) };
  redirect("/profile?password=updated");
}
