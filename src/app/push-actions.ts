"use server";

import { createClient } from "@/lib/supabase/server";

export async function savePushToken(token: string, platform: string): Promise<{ error?: string }> {
  if (typeof token !== "string" || token.length < 20 || token.length > 4096) return { error: "Google sent an unexpected phone address" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You're not logged in on this phone. Log in and try again" };
  const { error } = await supabase.rpc("save_push_token", { p_token: token, p_platform: platform === "ios" ? "ios" : "android" });
  return error ? { error: `Couldn't save: ${error.message}` } : {};
}

export async function removePushToken(token: string) {
  if (typeof token !== "string" || token.length < 20) return;
  const supabase = await createClient();
  await supabase.rpc("remove_push_token", { p_token: token });
}
