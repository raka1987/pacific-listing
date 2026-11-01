import type { Metadata } from "next";
import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { RefreshOnChatChange } from "@/components/chat-unread";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { CONVERSATION_COLUMNS, isUnread, type Conversation } from "@/lib/chat";
import { isBusiness, timeAgo } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Messages", robots: { index: false } };

export default async function MessagesPage() {
  const { user } = await requireUser("/messages");
  const supabase = await createClient();
  const { data } = await supabase
    .from("conversations")
    .select(CONVERSATION_COLUMNS)
    .or(`and(buyer_id.eq.${user.id},buyer_hidden.eq.false),and(seller_id.eq.${user.id},seller_hidden.eq.false)`)
    .not("last_message_at", "is", null)
    .order("last_message_at", { ascending: false })
    .limit(200);
  // Support chats started by staff live in Admin -> Member chats; members still see theirs here.
  const chats = ((data ?? []) as unknown as Conversation[]).filter((c) => !(c.is_support && c.buyer_id !== user.id));

  return (
    <div className="container-page max-w-3xl py-8">
      <RefreshOnChatChange />
      <PageHeader title="Messages" description="Your chats with buyers and sellers." />
      {chats.length ? (
        <ul className="card divide-y divide-line overflow-hidden p-0">
          {chats.map((c) => {
            const selling = c.seller_id === user.id;
            const other = selling ? c.buyer : c.seller;
            const name = c.is_support
              ? "Pacific Listing Support"
              : (!selling && isBusiness(other?.business_until) && other?.business_name) || other?.full_name || "Pacific Listing member";
            const unread = isUnread(c, user.id);
            return (
              <li key={c.id}>
                <Link href={`/messages/${c.id}`} className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-subtle">
                  <div className="relative">
                    <Avatar name={name} url={c.is_support ? "/icons/icon-192.png" : (other?.avatar_url ?? null)} size={48} />
                    {!c.is_support && c.listing_image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.listing_image} alt="" className="absolute -right-1 -bottom-1 h-6 w-6 rounded-md object-cover ring-2 ring-surface" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className={`truncate ${unread ? "font-bold text-ink" : "font-semibold text-ink"}`}>{name}</p>
                      <span className={`shrink-0 text-xs ${unread ? "font-semibold text-lagoon-700" : "text-faint"}`}>{timeAgo(c.last_message_at!)}</span>
                    </div>
                    <p className="truncate text-xs text-muted">
                      <span className={`mr-1.5 rounded px-1 py-px text-[10px] font-semibold uppercase ${c.is_support ? "bg-ocean-900 text-white" : selling ? "bg-coral-500/10 text-coral-700" : "bg-lagoon-50 text-lagoon-700"}`}>
                        {c.is_support ? "Official" : selling ? "Selling" : "Buying"}
                      </span>
                      {c.is_support ? "Messages from the Pacific Listing team" : c.listing_title}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <p className={`flex-1 truncate text-sm ${unread ? "font-medium text-ink" : "text-muted"}`}>
                        {c.last_sender_id === user.id && "You: "}
                        {c.last_message}
                      </p>
                      {unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-coral-500" aria-label="Unread" />}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          icon={MessagesSquare}
          title="No messages yet"
          description="When you message a seller, or a buyer messages you about your ad, the chat appears here."
          action={<Link href="/search" className="btn-primary">Browse listings</Link>}
        />
      )}
    </div>
  );
}
