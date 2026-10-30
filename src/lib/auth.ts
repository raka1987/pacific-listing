import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { PROFILE_COLUMNS, type Profile, type Role } from "./types";

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

export const STAFF_ROLES: Role[] = ["admin", "moderator", "sales"];
export const MOD_ROLES: Role[] = ["admin", "moderator"];
export const SALES_ROLES: Role[] = ["admin", "sales"];

/** Allows staff with one of the given roles; everyone else is sent away. */
export async function requireStaff(roles: Role[] = STAFF_ROLES) {
  const current = await getCurrentUser();
  if (!current) redirect("/login?next=/admin");
  const role = current.profile?.role;
  if (!role || current.profile?.is_banned || !STAFF_ROLES.includes(role)) redirect("/");
  if (!roles.includes(role)) redirect("/admin");
  return current as typeof current & { profile: Profile };
}

export async function requireAdmin() {
  return requireStaff(["admin"]);
}
