import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { MOD_ROLES, requireStaff } from "@/lib/auth";
import { CONVERSATION_COLUMNS, type ChatMessage, type Conversation } from "@/lib/chat";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Reported chat" };

/** Read-only view of a chat. The database only allows this once someone in the chat has reported it. */
export default async function AdminChat({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff(MOD_ROLES);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("conversations").select(CONVERSATION_COLUMNS).eq("id", id).maybeSingle();
  const chat = data as unknown as Conversation | null;
  if (!chat) notFound();
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
