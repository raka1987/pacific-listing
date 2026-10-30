import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChatThread } from "@/components/chat-thread";
import { requireUser } from "@/lib/auth";
import { CONVERSATION_COLUMNS, type ChatMessage, type Conversation } from "@/lib/chat";
import { formatPrice, isBusiness } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Chat", robots: { index: false } };

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await requireUser(`/messages/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("conversations").select(CONVERSATION_COLUMNS).eq("id", id).maybeSingle();
  const chat = data as unknown as Conversation | null;
  if (!chat || ![chat.buyer_id, chat.seller_id].includes(user.id)) notFound();

  const [{ data: messages }, { data: listing }] = await Promise.all([
    supabase.from("messages").select("id, conversation_id, sender_id, body, created_at").eq("conversation_id", id).order("id").limit(500),
    chat.listing_id
      ? supabase.from("listings").select("id, price, price_type, country, status").eq("id", chat.listing_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const selling = chat.seller_id === user.id;
  const other = selling ? chat.buyer : chat.seller;
  const business = !selling && isBusiness(other?.business_until) ? other?.business_name : null;
  const name = business || other?.full_name || "Pacific Listing member";
  const live = listing && ["active", "sold"].includes(listing.status);

  return (
    <div className="container-page max-w-3xl sm:py-6">
      <ChatThread
        conversationId={chat.id}
        me={user.id}
        other={{
          name,
          avatarUrl: other?.avatar_url ?? null,
          href: other && !selling ? `/seller/${other.id}` : null,
          role: selling ? "Interested in your ad" : business ? "Business seller" : "Seller",
        }}
        listing={{
          href: live ? `/listing/${listing.id}` : null,
          title: chat.listing_title,
          image: chat.listing_image,
          price: live ? formatPrice(listing.price, listing.price_type, listing.country) : null,
          sold: listing?.status === "sold",
        }}
        initialMessages={(messages ?? []) as ChatMessage[]}
        blockedBy={chat.blocked_by}
        starter={selling ? "" : `Hi! Is "${chat.listing_title}" still available?`}
      />
    </div>
  );
}
