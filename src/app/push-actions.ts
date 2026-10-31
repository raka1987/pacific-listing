"use server";

import { createClient } from "@/lib/supabase/server";

export async function savePushToken(token: string, platform: string) {
  if (typeof token !== "string" || token.length < 20 || token.length > 4096) return;
  const supabase = await createClient();
  await supabase.rpc("save_push_token", { p_token: token, p_platform: platform === "ios" ? "ios" : "android" });
}

export async function removePushToken(token: string) {
  if (typeof token !== "string" || token.length < 20) return;
  const supabase = await createClient();
  await supabase.rpc("remove_push_token", { p_token: token });
}
