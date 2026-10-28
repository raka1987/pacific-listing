"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { COUNTRIES, SITE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; message?: string };

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

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
    return {
      error: error.message === "Email not confirmed" ? "Please confirm your email first — check your inbox." : "Wrong email or password.",
    };
  }
  redirect(safeNext(str(fd, "next")));
}

export async function signup(_: AuthState, fd: FormData): Promise<AuthState> {
  const full_name = str(fd, "full_name");
  const email = str(fd, "email");
  const password = String(fd.get("password") ?? "");
  const country = str(fd, "country");
  if (full_name.length < 2) return { error: "Please enter your name." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name, country: COUNTRIES.some((c) => c.code === country) ? country : null, phone: str(fd, "phone") || null },
      emailRedirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(safeNext(str(fd, "next")))}`,
    },
  });
  if (error) return { error: error.message };
  if (!data.session) return { message: `We've sent a confirmation link to ${email}. Click it to activate your account.` };
  redirect(safeNext(str(fd, "next")));
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
  if (error) return { error: error.message };
  redirect("/profile?password=updated");
}
