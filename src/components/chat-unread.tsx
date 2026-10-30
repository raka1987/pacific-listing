"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";

// One live connection per page keeps every unread badge and the inbox up to date.
let unread: number | null = null;
let version = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Listens for chat changes while someone is logged in. Rendered once in the site layout. */
export function ChatWatcher({ userId }: { userId: string }) {
  useEffect(() => {
    const supabase = createClient();
    let alive = true;
    const refresh = async () => {
      const { data } = await supabase.rpc("my_unread_chats");
      if (!alive || typeof data !== "number") return;
      unread = data;
      version++;
      emit();
    };
    const channel = supabase.channel(`chats:${userId}`);
    channel.on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, refresh);
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!alive || !session) return;
      await supabase.realtime.setAuth(session.access_token);
      channel.subscribe();
    });
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [userId]);
  return null;
}

export function useUnreadChats(initial: number) {
  return useSyncExternalStore(
    subscribe,
    () => unread ?? initial,
    () => initial,
  );
}

export function UnreadBadge({ initial, className = "" }: { initial: number; className?: string }) {
  const n = useUnreadChats(initial);
  if (!n) return null;
  return (
    <span
      className={`flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-coral-500 px-1 text-[10px] leading-none font-bold text-white ring-2 ring-surface ${className}`}
      aria-label={`${n} unread`}
    >
      {n > 9 ? "9+" : n}
    </span>
  );
}

/** Re-renders the page whenever a chat changes (used by the inbox). */
export function RefreshOnChatChange() {
  const router = useRouter();
  const v = useSyncExternalStore(subscribe, () => version, () => 0);
  const first = useRef(v);
  useEffect(() => {
    if (v !== first.current) router.refresh();
  }, [v, router]);
  return null;
}
