import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ChatThread } from "@/components/chat-thread";
import { requireUser } from "@/lib/auth";
import { CONVERSATION_COLUMNS, type ChatMessage, type Conversation } from "@/lib/chat";
import { formatPrice, isBusiness } from "@/lib/format";
import { getListingContact } from "@/lib/contact";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Chat", robots: { index: false } };

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await requireUser(`/messages/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("conversations").select(CONVERSATION_COLUMNS).eq("id", id).maybeSingle();
  const chat = data as unknown as Conversation | null;
  if (!chat) notFound();
  // Staff open support chats in the admin panel, where they can see who they're talking to.
  if (chat.is_support && chat.buyer_id !== user.id) redirect(`/admin/chats/${chat.id}`);
  if (![chat.buyer_id, chat.seller_id].includes(user.id)) notFound();

  const otherId = chat.seller_id === user.id ? chat.buyer_id : chat.seller_id;
  const [{ data: messages }, { data: listing }, { data: rating }, { data: myReview }] = await Promise.all([
    supabase.from("messages").select("*").eq("conversation_id", id).order("id").limit(500),
    chat.listing_id
      ? supabase.from("listings").select("id, price, price_type, country, status").eq("id", chat.listing_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("member_ratings").select("average, total").eq("member_id", otherId).maybeSingle(),
    supabase.from("reviews").select("rating, comment").eq("reviewer_id", user.id).eq("reviewee_id", otherId).maybeSingle(),
  ]);

  const selling = chat.seller_id === user.id;
  // Private numbers: the buyer can ask for the seller's number and the seller can share it.
  const contact = !chat.is_support && chat.listing_id && listing ? await getListingContact(supabase, chat.listing_id) : null;
  const numbers =
    contact && chat.listing_id
      ? { role: selling ? ("seller" as const) : ("buyer" as const), listingId: chat.listing_id, contact, sharedAt: chat.number_shared_at ?? null }
      : null;
  const other = selling ? chat.buyer : chat.seller;
  const business = !selling && isBusiness(other?.business_until) ? other?.business_name : null;
  const name = business || other?.full_name || "Pacific Listing member";
  const live = listing && ["active", "sold"].includes(listing.status);

  if (chat.is_support) {
    return (
      <div className="container-page max-w-3xl sm:py-6">
        <ChatThread
          conversationId={chat.id}
          me={user.id}
          support="member"
          other={{ id: "support", name: "Pacific Listing Support", avatarUrl: "/icons/icon-192.png", href: null, role: "Official", verified: true, rating: null }}
          myReview={null}
          listing={{ href: null, title: "Pacific Listing Support", image: "/icons/icon-192.png", price: null, sold: false }}
          initialMessages={(messages ?? []) as ChatMessage[]}
          blockedBy={null}
          starter=""
        />
      </div>
    );
  }

  return (
    <div className="container-page max-w-3xl sm:py-6">
      <ChatThread
        conversationId={chat.id}
        me={user.id}
        other={{
          id: otherId,
          verified: !!other?.is_verified,
          rating: rating as { average: number; total: number } | null,
          name,
          avatarUrl: other?.avatar_url ?? null,
          href: other ? `/seller/${other.id}` : null,
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
        myReview={myReview as { rating: number; comment: string | null } | null}
        blockedBy={chat.blocked_by}
        starter={selling ? "" : `Hi! Is "${chat.listing_title}" still available?`}
        numbers={numbers}
      />
    </div>
  );
}
