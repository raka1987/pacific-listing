"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CHAT_REPORT_REASONS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

type Result = { error?: string; ok?: boolean };

/** Opens the chat with the seller of an ad (logging in first if needed). */
export async function startChat(listingId: string): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/listing/${listingId}`)}`);
  const { data, error } = await supabase.rpc("start_conversation", { p_listing: listingId });
  if (error || !data) return { error: error?.message || "Couldn't open the chat. Please try again." };
  redirect(`/messages/${data}`);
}

export async function reportChat(conversationId: string, reason: string, details: string): Promise<Result> {
  if (!CHAT_REPORT_REASONS.includes(reason)) return { error: "Choose a reason." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in." };
  const { error } = await supabase.from("reports").insert({
    conversation_id: conversationId,
    reporter_id: user.id,
    reason,
    details: details.slice(0, 2000) || null,
  });
  if (error) return { error: "Could not send report. Please try again." };
  return { ok: true };
}

export async function setChatBlocked(conversationId: string, blocked: boolean) {
  const supabase = await createClient();
  await supabase.rpc("set_chat_blocked", { cid: conversationId, blocked });
  revalidatePath(`/messages/${conversationId}`);
}

export async function deleteChat(conversationId: string) {
  const supabase = await createClient();
  await supabase.rpc("hide_chat", { cid: conversationId });
  revalidatePath("/messages");
  redirect("/messages");
}
