import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { PROFILE_COLUMNS, type Profile } from "./types";

export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", user.id).single<Profile>();
  return { user, profile };
});

export async function requireUser(next: string) {
  const current = await getCurrentUser();
  if (!current) redirect(`/login?next=${encodeURIComponent(next)}`);
  return current;
}

export async function requireAdmin() {
  const current = await getCurrentUser();
  if (!current) redirect("/login?next=/admin");
  if (current.profile?.role !== "admin" || current.profile.is_banned) redirect("/");
  return current;
}
