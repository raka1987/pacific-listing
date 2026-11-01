import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { MOD_ROLES, requireStaff, STAFF_ROLES } from "@/lib/auth";
import { ChatThread } from "@/components/chat-thread";
import { CONVERSATION_COLUMNS, type ChatMessage, type Conversation } from "@/lib/chat";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Reported chat" };

/** Read-only view of a chat. The database only allows this once someone in the chat has reported it. */
export default async function AdminChat({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireStaff(STAFF_ROLES);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("conversations").select(CONVERSATION_COLUMNS).eq("id", id).maybeSingle();
  const chat = data as unknown as Conversation | null;
  if (!chat) notFound();

  // A chat from Pacific Listing Support: any staff member can reply here.
  if (chat.is_support) {
    const [{ data: rows }, { data: detail }] = await Promise.all([
      supabase.from("messages").select("*").eq("conversation_id", id).order("id").limit(500),
      supabase.rpc("admin_user_detail", { p_id: chat.buyer_id }),
    ]);
    const member = chat.buyer;
    const info = (detail ?? {}) as { email?: string; phone?: string | null; whatsapp?: string | null; created_at?: string; city?: string | null; country?: string | null };
    // Names of the staff who wrote in this chat (members only ever see "Pacific Listing Support").
    const staffIds = [...new Set(((rows ?? []) as ChatMessage[]).map((m) => m.sender_id).filter((s) => s !== chat.buyer_id).concat(user.id))];
    const { data: staffRows } = await supabase.from("profiles").select("id, full_name").in("id", staffIds);
    const senderNames = Object.fromEntries((staffRows ?? []).map((s) => [s.id, s.full_name || "Staff"]));
    return (
      <div className="max-w-3xl">
        <div className="card mb-4 flex flex-wrap items-center gap-x-6 gap-y-1 p-4 text-sm">
          <span className="font-semibold text-ink">Chat with {member?.full_name || "Member"}</span>
          {info.email && <a href={`mailto:${info.email}`} className="text-lagoon-700 hover:underline">{info.email}</a>}
          {(info.phone || info.whatsapp) && <span className="text-ink-2">{info.phone || info.whatsapp}</span>}
          {info.created_at && <span className="text-muted">Member since {formatDate(info.created_at)}</span>}
          <Link href={`/admin/users/${chat.buyer_id}`} className="ml-auto font-medium text-lagoon-700 hover:underline">View member →</Link>
          <p className="w-full text-xs text-muted">The member sees your messages from &quot;Pacific Listing Support&quot;. Staff names below are only shown to staff.</p>
        </div>
        <ChatThread
          conversationId={chat.id}
          me={user.id}
          support="staff"
          memberId={chat.buyer_id}
          backHref="/admin/chats"
          other={{
            id: chat.buyer_id,
            name: member?.full_name || "Member",
            avatarUrl: member?.avatar_url ?? null,
            href: `/admin/users/${chat.buyer_id}`,
            role: info.email ?? "Member",
            verified: !!member?.is_verified,
            rating: null,
          }}
          myReview={null}
          listing={{ href: null, title: "Pacific Listing Support", image: "/icons/icon-192.png", price: null, sold: false }}
          initialMessages={(rows ?? []) as ChatMessage[]}
          blockedBy={null}
          starter=""
          senderNames={senderNames}
        />
      </div>
    );
  }
  await requireStaff(MOD_ROLES);
  const { data: rows } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, body, created_at")
    .eq("conversation_id", id)
    .order("id")
    .limit(1000);
  const messages = (rows ?? []) as ChatMessage[];
  const names: Record<string, string> = {
    [chat.buyer_id]: `${chat.buyer?.full_name || "Buyer"} (buyer)`,
    [chat.seller_id]: `${chat.seller?.full_name || "Seller"} (seller)`,
  };

  return (
    <div className="max-w-3xl">
      <Link href="/admin/reports" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Reports
      </Link>
      <h1 className="text-2xl font-semibold text-ink">Chat about “{chat.listing_title}”</h1>
      <p className="mt-2 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        Private chat, shown because it was reported. Use it only to check the report.
      </p>
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <Link href={`/admin/users/${chat.buyer_id}`} className="rounded-full bg-surface px-3 py-1.5 font-medium text-ink-2 ring-1 ring-line hover:bg-subtle">
          Buyer: {chat.buyer?.full_name || "member"}
        </Link>
        <Link href={`/admin/users/${chat.seller_id}`} className="rounded-full bg-surface px-3 py-1.5 font-medium text-ink-2 ring-1 ring-line hover:bg-subtle">
          Seller: {chat.seller?.full_name || "member"}
        </Link>
        {chat.listing_id && (
          <Link href={`/listing/${chat.listing_id}`} target="_blank" className="rounded-full bg-surface px-3 py-1.5 font-medium text-lagoon-700 ring-1 ring-line hover:bg-subtle">
            View ad
          </Link>
        )}
      </div>
      <ul className="card mt-5 space-y-3 p-4">
        {messages.length ? (
          messages.map((m) => (
            <li key={m.id} className={m.sender_id === chat.seller_id ? "pl-6" : "pr-6"}>
              <p className="text-xs text-muted">
                <span className="font-semibold text-ink-2">{names[m.sender_id] ?? "Unknown"}</span> · {new Date(m.created_at).toLocaleString()}
              </p>
              <p className="mt-0.5 rounded-xl bg-subtle px-3 py-2 text-sm break-words whitespace-pre-line text-ink">{m.body}</p>
            </li>
          ))
        ) : (
          <li className="text-sm text-muted">No messages.</li>
        )}
      </ul>
    </div>
  );
}
