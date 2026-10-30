"use client";

import Link from "next/link";
import { ArrowLeft, Ban, ExternalLink, MoreVertical, SendHorizontal, ShieldCheck, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deleteChat, setChatBlocked } from "@/app/chat-actions";
import type { ChatMessage } from "@/lib/chat";
import { createClient } from "@/lib/supabase/client";
import { track } from "@/lib/track";
import { Avatar } from "./avatar";
import { ReportDialog } from "./report-dialog";

type Props = {
  conversationId: string;
  me: string;
  other: { name: string; avatarUrl: string | null; href: string | null; role: string };
  listing: { href: string | null; title: string; image: string | null; price: string | null; sold: boolean };
  initialMessages: ChatMessage[];
  blockedBy: string | null;
  starter: string;
};

const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
function day(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 864e5);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

export function ChatThread({ conversationId, me, other, listing, initialMessages, blockedBy, starter }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState(initialMessages.length ? "" : starter);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [menu, setMenu] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const lastId = useRef(initialMessages.at(-1)?.id ?? 0);

  const add = useCallback((incoming: ChatMessage[]) => {
    if (!incoming.length) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const fresh = incoming.filter((m) => !seen.has(m.id));
      if (!fresh.length) return prev;
      lastId.current = Math.max(lastId.current, ...fresh.map((m) => m.id));
      return [...prev, ...fresh].sort((a, b) => a.id - b.id);
    });
  }, []);

  const markRead = useCallback(() => {
    if (document.visibilityState === "visible") supabase.rpc("mark_chat_read", { cid: conversationId }).then(() => {});
  }, [supabase, conversationId]);

  // Live messages, plus a catch-up whenever the screen comes back into view.
  useEffect(() => {
    let alive = true;
    const catchUp = async () => {
      const { data } = await supabase
        .from("messages")
        .select("id, conversation_id, sender_id, body, created_at")
        .eq("conversation_id", conversationId)
        .gt("id", lastId.current)
        .order("id");
      if (alive && data?.length) {
        add(data as ChatMessage[]);
        markRead();
      }
    };
    const channel = supabase.channel(`chat:${conversationId}`).on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
      (payload) => {
        const m = payload.new as ChatMessage;
        add([m]);
        if (m.sender_id !== me) markRead();
      },
    );
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!alive || !session) return;
      await supabase.realtime.setAuth(session.access_token);
      channel.subscribe((status) => status === "SUBSCRIBED" && catchUp());
    });
    markRead();
    const onVisible = () => {
      if (document.visibilityState === "visible") catchUp();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [supabase, conversationId, me, add, markRead]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError("");
    const { data, error } = await supabase
      .from("messages")
      .insert({ conversation_id: conversationId, sender_id: me, body })
      .select("id, conversation_id, sender_id, body, created_at")
      .single();
    setSending(false);
    if (error) {
      setError(error.message.includes("row-level security") ? "Couldn't send. Please refresh the page and try again." : error.message);
      return;
    }
    if (!messages.length) track("contact_seller", { method: "chat" });
    add([data as ChatMessage]);
    setText("");
    input.current?.focus();
  }

  const blockedByMe = blockedBy === me;
  const menuItem = "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-ink-2 hover:bg-subtle";

  return (
    <div className="chat-page fixed inset-0 z-50 flex flex-col bg-canvas sm:static sm:z-auto sm:h-[calc(100dvh-10rem)] sm:min-h-[480px] sm:overflow-hidden sm:rounded-3xl sm:border sm:border-line sm:bg-surface sm:shadow-sm">
      {/* Top bar */}
      <header className="flex items-center gap-3 border-b border-line bg-surface px-3 pt-[calc(0.6rem+env(safe-area-inset-top))] pb-2.5 sm:px-4 sm:pt-3">
        <Link href="/messages" className="flex h-9 w-9 items-center justify-center rounded-full text-ink-2 hover:bg-subtle" aria-label="Back to messages">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <Avatar name={other.name} url={other.avatarUrl} size={40} />
        <div className="min-w-0 flex-1">
          {other.href ? (
            <Link href={other.href} className="block truncate font-semibold text-ink hover:underline">{other.name}</Link>
          ) : (
            <p className="truncate font-semibold text-ink">{other.name}</p>
          )}
          <p className="truncate text-xs text-muted">{other.role}</p>
        </div>
        <div className="relative">
          <button onClick={() => setMenu((m) => !m)} className="flex h-9 w-9 items-center justify-center rounded-full text-ink-2 hover:bg-subtle" aria-label="Chat options" aria-expanded={menu}>
            <MoreVertical className="h-5 w-5" />
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
              <div className="absolute right-0 z-20 mt-1 w-56 rounded-2xl border border-line bg-surface p-2 shadow-xl" role="menu">
                {listing.href && (
                  <Link href={listing.href} className={menuItem} role="menuitem">
                    <ExternalLink className="h-4 w-4" /> View ad
                  </Link>
                )}
                <form action={setChatBlocked.bind(null, conversationId, !blockedByMe)} onSubmit={() => setMenu(false)}>
                  <button className={menuItem} role="menuitem">
                    <Ban className="h-4 w-4" /> {blockedByMe ? "Unblock" : "Block"} {other.name.split(" ")[0]}
                  </button>
                </form>
                <div className="px-3 py-2">
                  <ReportDialog conversationId={conversationId} />
                </div>
                <form
                  action={deleteChat.bind(null, conversationId)}
                  onSubmit={(e) => {
                    if (!confirm("Delete this chat from your messages? It comes back if they message you again.")) e.preventDefault();
                  }}
                >
                  <button className={`${menuItem} text-red-600`} role="menuitem">
                    <Trash2 className="h-4 w-4" /> Delete chat
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </header>

      {/* The ad this chat is about */}
      <div className="flex items-center gap-3 border-b border-line bg-surface/70 px-4 py-2">
        {listing.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={listing.image} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
        ) : (
          <span className="h-10 w-10 shrink-0 rounded-lg bg-subtle" />
        )}
        <div className="min-w-0 flex-1 text-sm">
          {listing.href ? (
            <Link href={listing.href} className="block truncate font-medium text-ink hover:underline">{listing.title}</Link>
          ) : (
            <p className="truncate font-medium text-ink">{listing.title}</p>
          )}
          <p className="truncate text-xs text-muted">{listing.sold ? "Sold" : listing.href ? listing.price : "This ad has been removed"}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5">
        <p className="mx-auto mb-4 flex max-w-sm items-start gap-2 rounded-2xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Meet in a public place and check the item before paying. Never send money in advance.</span>
        </p>
        {messages.length === 0 && <p className="mt-10 text-center text-sm text-muted">Say hello and ask about the item.</p>}
        <ul className="space-y-1.5">
          {messages.map((m, i) => {
            const mine = m.sender_id === me;
            const prev = messages[i - 1];
            const newDay = !prev || day(prev.created_at) !== day(m.created_at);
            return (
              <li key={m.id}>
                {newDay && <p className="my-3 text-center text-[11px] font-semibold tracking-wide text-faint uppercase">{day(m.created_at)}</p>}
                <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-[15px] leading-snug shadow-sm sm:max-w-[70%] ${
                      mine ? "rounded-br-md bg-lagoon-600 text-white" : "rounded-bl-md bg-surface text-ink ring-1 ring-line"
                    }`}
                  >
                    <p className="break-words whitespace-pre-line">{m.body}</p>
                    <p className={`mt-0.5 text-right text-[10px] ${mine ? "text-white/70" : "text-faint"}`}>{time(m.created_at)}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <div ref={bottom} />
      </div>

      {/* Composer */}
      <div className="border-t border-line bg-surface px-3 pt-2.5 pb-[calc(0.6rem+env(safe-area-inset-bottom))] sm:px-4 sm:pb-3">
        {blockedBy ? (
          <p className="py-2 text-center text-sm text-muted">
            {blockedByMe ? "You blocked this person. Unblock them from the menu to chat again." : "You can't reply to this chat."}
          </p>
        ) : (
          <form onSubmit={send} className="flex items-end gap-2">
            <textarea
              ref={input}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia("(pointer: fine)").matches) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={Math.min(5, Math.max(1, text.split("\n").length))}
              maxLength={2000}
              placeholder="Write a message…"
              aria-label="Message"
              className="input max-h-36 min-h-11 flex-1 resize-none rounded-2xl py-2.5"
            />
            <button disabled={sending || !text.trim()} className="btn-primary h-11 w-11 shrink-0 rounded-full p-0" aria-label="Send">
              <SendHorizontal className="h-5 w-5" />
            </button>
          </form>
        )}
        {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
