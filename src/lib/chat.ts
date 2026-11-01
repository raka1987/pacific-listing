import { cache } from "react";
import { getAuthUser } from "./auth";
import { createClient } from "./supabase/server";
import type { Profile } from "./types";

export type ChatPerson = Pick<Profile, "id" | "full_name" | "avatar_url" | "business_name" | "business_until" | "is_verified">;

export type Conversation = {
  id: string;
  listing_id: string | null;
  listing_title: string;
  listing_image: string | null;
  last_message: string | null;
  last_message_at: string | null;
  last_sender_id: string | null;
  buyer_id: string;
  seller_id: string;
  buyer_read_at: string;
  seller_read_at: string;
  blocked_by: string | null;
  buyer: ChatPerson | null;
  seller: ChatPerson | null;
};

export type ChatMessage = { id: number; conversation_id: string; sender_id: string; body: string; created_at: string; edited_at?: string | null };

const PERSON = "id, full_name, avatar_url, business_name, business_until, is_verified";
export const CONVERSATION_COLUMNS =
  "id, listing_id, listing_title, listing_image, last_message, last_message_at, last_sender_id, buyer_id, seller_id, buyer_read_at, seller_read_at, blocked_by, " +
  `buyer:profiles!conversations_buyer_id_fkey(${PERSON}), seller:profiles!conversations_seller_id_fkey(${PERSON})`;

/** Number of chats with unread messages for the logged-in person (0 when logged out). */
export const getUnreadChats = cache(async () => {
  const user = await getAuthUser();
  if (!user) return 0;
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_unread_chats");
  return typeof data === "number" ? data : 0;
});

export function isUnread(c: Conversation, me: string) {
  if (!c.last_sender_id || c.last_sender_id === me || !c.last_message_at) return false;
  const readAt = c.buyer_id === me ? c.buyer_read_at : c.seller_read_at;
  return c.last_message_at > readAt;
}
