"use client";

import Link from "next/link";
import { ArrowLeft, Ban, BadgeCheck, Check, ExternalLink, MoreVertical, Pencil, SendHorizontal, ShieldCheck, Star, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { deleteChat, setChatBlocked } from "@/app/chat-actions";
import type { ChatMessage } from "@/lib/chat";
import { createClient } from "@/lib/supabase/client";
import { track } from "@/lib/track";
import { Avatar } from "./avatar";
import { ASK_FOR_NUMBER, ChatNumbersStrip, type ChatNumbers } from "./chat-numbers";
import { RateMember } from "./rate-member";
import { ReportDialog } from "./report-dialog";

type Props = {
  conversationId: string;
  me: string;
  other: { id: string; name: string; avatarUrl: string | null; href: string | null; role: string; verified: boolean; rating: { average: number; total: number } | null };
  myReview: { rating: number; comment: string | null } | null;
  listing: { href: string | null; title: string; image: string | null; price: string | null; sold: boolean };
  initialMessages: ChatMessage[];
  blockedBy: string | null;
  starter: string;
  /** "member": a member reading a chat from Pacific Listing Support. "staff": staff replying in the admin panel. */
  support?: "member" | "staff";
  /** In the staff view, messages from anyone but this member count as "ours". */
  memberId?: string;
  backHref?: string;
  /** Staff view: who wrote each team message, for the record. */
  senderNames?: Record<string, string>;
  /** Private phone numbers: lets the buyer ask and the seller share. */
  numbers?: ChatNumbers | null;
};

// Times use the reader's own time zone, so they're only filled in on the phone or computer
// (the server's time zone would be wrong for most people).
const EDIT_WINDOW = 15 * 60 * 1000;
const noop = () => () => {};
const useOnDevice = () => useSyncExternalStore(noop, () => true, () => false);

const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
function day(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 864e5);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

export function ChatThread({ conversationId, me, other, myReview, listing, initialMessages, blockedBy, starter, support, memberId, backHref = "/messages", senderNames, numbers }: Props) {
  const isMine = (m: ChatMessage) => (support === "staff" ? m.sender_id !== memberId : m.sender_id === me);
  const supabase = useMemo(() => createClient(), []);
  const onDevice = useOnDevice();
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState(initialMessages.length ? "" : starter);
  // Your own message that's showing its Edit button, and the one being edited.
  const [picked, setPicked] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const canEdit = (m: ChatMessage) => m.sender_id === me && Date.now() - new Date(m.created_at).getTime() < EDIT_WINDOW;
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [menu, setMenu] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const lastId = useRef(initialMessages[initialMessages.length - 1]?.id ?? 0);

  const add = useCallback((incoming: ChatMessage[]) => {
    if (!incoming.length) return;
    setMessages((prev) => {
      const byId = new Map(prev.map((m) => [m.id, m]));
      let changed = false;
      for (const m of incoming) {
        const old = byId.get(m.id);
        // New message, or an edited one (keep whichever version is newer).
        if (!old || (m.edited_at && m.edited_at !== old.edited_at && m.body !== old.body)) {
          byId.set(m.id, { ...old, ...m });
          changed = true;
        }
      }
      if (!changed) return prev;
      lastId.current = Math.max(lastId.current, ...incoming.map((m) => m.id));
      return [...byId.values()].sort((a, b) => a.id - b.id);
    });
  }, []);

  const markRead = useCallback(() => {
    if (document.visibilityState === "visible") supabase.rpc("mark_chat_read", { cid: conversationId }).then(() => {});
  }, [supabase, conversationId]);

  // Live messages, plus a catch-up whenever the screen comes back into view.
  useEffect(() => {
    let alive = true;
    let editsSince = new Date().toISOString();
    const catchUp = async () => {
      const since = editsSince;
      editsSince = new Date().toISOString();
      const [{ data }, { data: edits }] = await Promise.all([
        supabase.from("messages").select("*").eq("conversation_id", conversationId).gt("id", lastId.current).order("id"),
        supabase.from("messages").select("*").eq("conversation_id", conversationId).gt("edited_at", since),
      ]);
      if (alive && edits?.length) add(edits as ChatMessage[]);
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
    ).on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
      (payload) => add([payload.new as ChatMessage]),
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
    // Backup for phones and networks that drop the live connection: check every few seconds.
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") catchUp();
    }, 3000);
    return () => {
      alive = false;
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [supabase, conversationId, me, add, markRead]);

  // Keep the newest messages in view: when new ones arrive, and when the keyboard opens or the
  // message box grows (which shrinks the chat area), unless the person has scrolled up to read.
  const list = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const toBottom = useCallback(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);
  useEffect(() => {
    toBottom();
  }, [messages.length, toBottom]);
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    const keep = () => atBottom.current && toBottom();
    const onScroll = () => {
      atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(keep) : null;
    ro?.observe(el);
    if (el.firstElementChild) ro?.observe(el.firstElementChild);
    window.visualViewport?.addEventListener("resize", keep);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro?.disconnect();
      window.visualViewport?.removeEventListener("resize", keep);
    };
  }, [toBottom]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError("");
    if (editing) {
      const { data: saved, error: editError } = await supabase.rpc("edit_message", { p_id: editing, p_body: body });
      setSending(false);
      if (editError) return setError(editError.message.includes("function") ? "Editing isn't switched on yet." : editError.message);
      const original = messages.find((m) => m.id === editing);
      if (original && saved) add([{ ...original, ...(saved as Partial<ChatMessage>) } as ChatMessage]);
      setEditing(null);
      setText("");
      return;
    }
    if (await post(body)) {
      setText("");
      input.current?.focus();
    }
  }

  async function post(body: string) {
    setSending(true);
    setError("");
    const { data, error } = await supabase
      .from("messages")
      .insert({ conversation_id: conversationId, sender_id: me, body })
      .select("*")
      .single();
    setSending(false);
    if (error) {
      setError(error.message.includes("row-level security") ? "Couldn't send. Please refresh the page and try again." : error.message);
      return false;
    }
    if (!messages.length) track("contact_seller", { method: "chat" });
    add([data as ChatMessage]);
    return true;
  }

  const blockedByMe = blockedBy === me;
  // Ratings open once both people have said something.
  const canRate = !support && messages.some((m) => m.sender_id === me) && messages.some((m) => m.sender_id !== me);
  const menuItem = "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-ink-2 hover:bg-subtle";

  return (
    <div className="chat-page fixed inset-0 z-50 flex flex-col bg-canvas sm:static sm:z-auto sm:h-[calc(100dvh-10rem)] sm:min-h-[480px] sm:overflow-hidden sm:rounded-3xl sm:border sm:border-line sm:bg-surface sm:shadow-sm">
      {/* Top bar */}
      <header className="flex items-center gap-3 border-b border-line bg-surface px-3 pt-[calc(0.6rem+env(safe-area-inset-top))] pb-2.5 sm:px-4 sm:pt-3">
        <Link href={backHref} className="flex h-9 w-9 items-center justify-center rounded-full text-ink-2 hover:bg-subtle" aria-label="Back to messages">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <Avatar name={other.name} url={other.avatarUrl} size={40} />
        <div className="min-w-0 flex-1">
          {other.href ? (
            <Link href={other.href} className="flex min-w-0 items-center gap-1 font-semibold text-ink hover:underline">
              <span className="truncate">{other.name}</span>
              {other.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-lagoon-600" aria-label="Verified" />}
            </Link>
          ) : (
            <p className="flex min-w-0 items-center gap-1 font-semibold text-ink">
              <span className="truncate">{other.name}</span>
              {other.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-lagoon-600" aria-label="Verified" />}
            </p>
          )}
          <p className="flex items-center gap-1 truncate text-xs text-muted">
            {other.rating && other.rating.total > 0 && (
              <>
                <Star className="h-3 w-3 text-amber-400" fill="currentColor" strokeWidth={0} />
                <span className="font-semibold text-ink-2">{Number(other.rating.average).toFixed(1)}</span>
                <span>({other.rating.total}) ·</span>
              </>
            )}
            {other.role}
          </p>
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
                {canRate && <RateMember conversationId={conversationId} name={other.name} existing={myReview} className={menuItem} />}
                {!support && (
                  <>
                    <form action={setChatBlocked.bind(null, conversationId, !blockedByMe)} onSubmit={() => setMenu(false)}>
                      <button className={menuItem} role="menuitem">
                        <Ban className="h-4 w-4" /> {blockedByMe ? "Unblock" : "Block"} {other.name.split(" ")[0]}
                      </button>
                    </form>
                    <ReportDialog conversationId={conversationId} triggerClassName={menuItem} />
                  </>
                )}
                {support !== "staff" && <form
                  action={deleteChat.bind(null, conversationId)}
                  onSubmit={(e) => {
                    if (!confirm("Delete this chat from your messages? It comes back if they message you again.")) e.preventDefault();
                  }}
                >
                  <button className={`${menuItem} text-red-600`} role="menuitem">
                    <Trash2 className="h-4 w-4" /> Delete chat
                  </button>
                </form>}
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
          <p className="truncate text-xs text-muted">{support ? "Official messages from the Pacific Listing team" : listing.sold ? "Sold" : listing.href ? listing.price : "This ad has been removed"}</p>
        </div>
      </div>

      {numbers && !support && !blockedBy && (
        <ChatNumbersStrip
          conversationId={conversationId}
          numbers={numbers}
          messageCount={messages.length}
          asked={messages.some((m) => m.sender_id === me && m.body === ASK_FOR_NUMBER)}
          onAsk={() => !sending && post(ASK_FOR_NUMBER)}
        />
      )}

      {/* Messages */}
      <div ref={list} className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5">
        <div>
        {!support && (
          <p className="mx-auto mb-4 flex max-w-sm items-start gap-2 rounded-2xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Meet in a public place and check the item before paying. Never send money in advance.</span>
        </p>
        )}
        {messages.length === 0 && <p className="mt-10 text-center text-sm text-muted">Say hello and ask about the item.</p>}
        <ul className="space-y-1.5">
          {messages.map((m, i) => {
            const mine = isMine(m);
            const prev = messages[i - 1];
            const newDay = !prev || day(prev.created_at) !== day(m.created_at);
            return (
              <li key={m.id}>
                {newDay && <p className="my-3 h-4 text-center text-[11px] font-semibold tracking-wide text-faint uppercase">{onDevice ? day(m.created_at) : ""}</p>}
                <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                  <div
                    onClick={() => onDevice && canEdit(m) && !blockedBy && setPicked(picked === m.id ? null : m.id)}
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-[15px] leading-snug shadow-sm sm:max-w-[70%] ${
                      mine ? "rounded-br-md bg-lagoon-600 text-white" : "rounded-bl-md bg-surface text-ink ring-1 ring-line"
                    } ${editing === m.id ? "ring-2 ring-coral-400" : ""} ${onDevice && canEdit(m) ? "cursor-pointer" : ""}`}
                  >
                    <p className="break-words whitespace-pre-line">{m.body}</p>
                    <p className={`mt-0.5 h-3.5 text-right text-[10px] ${mine ? "text-white/70" : "text-faint"}`}>
                      {senderNames && mine ? `${senderNames[m.sender_id] ?? "Staff"} · ` : ""}
                      {m.edited_at ? "edited · " : ""}
                      {onDevice ? time(m.created_at) : ""}
                    </p>
                  </div>
                  {picked === m.id && canEdit(m) && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(m.id);
                        setText(m.body);
                        setPicked(null);
                        setError("");
                        input.current?.focus();
                      }}
                      className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-ink-2 shadow-sm ring-1 ring-line"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-line bg-surface px-3 pt-2.5 pb-[calc(0.6rem+env(safe-area-inset-bottom))] sm:px-4 sm:pb-3">
        {blockedBy ? (
          <p className="py-2 text-center text-sm text-muted">
            {blockedByMe ? "You blocked this person. Unblock them from the menu to chat again." : "You can't reply to this chat."}
          </p>
        ) : (
          <>
          {editing && (
            <div className="mb-2 flex items-center gap-2 rounded-xl bg-coral-500/10 px-3 py-2 text-sm font-medium text-coral-700 dark:text-coral-400">
              <Pencil className="h-4 w-4 shrink-0" />
              <span className="flex-1">Editing your message</span>
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setText("");
                }}
                className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-coral-500/20"
                aria-label="Cancel editing"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <form onSubmit={send} className="flex items-end gap-2">
            <textarea
              ref={input}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onFocus={() => {
                atBottom.current = true;
                setTimeout(toBottom, 300);
              }}
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
            <button disabled={sending || !text.trim()} className="btn-primary h-11 w-11 shrink-0 rounded-full p-0" aria-label={editing ? "Save changes" : "Send"}>
              {editing ? <Check className="h-5 w-5" /> : <SendHorizontal className="h-5 w-5" />}
            </button>
          </form>
          </>
        )}
        {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
