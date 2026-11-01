"use client";

import { MessagesSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { removePushToken } from "@/app/push-actions";
import { PUSH_TOKEN_KEY } from "./push-setup";
import { capacitor, isNativeApp, nativePlugin, type NativePlugins, type PushPlugin } from "@/lib/native";


/** Runs a phone feature call without letting a missing or old plugin crash the page. */
function safely(fn: () => unknown) {
  try {
    const r = fn();
    if (r && typeof (r as Promise<unknown>).catch === "function") (r as Promise<unknown>).catch(() => {});
    return r;
  } catch {
    return undefined;
  }
}

/** Makes the website behave like an app when opened inside the phone apps. */
export function NativeApp({ userId }: { userId: string | null }) {
  const [banner, setBanner] = useState<{ title: string; body: string; url: string } | null>(null);
  useEffect(() => {
    if (!isNativeApp()) return;
    const root = document.documentElement;
    root.classList.add("native-app");
    const plugins = { App: nativePlugin<NativePlugins["App"]>("App"), StatusBar: nativePlugin<NativePlugins["StatusBar"]>("StatusBar") };

    // Android back button: go back a page, or close the app from the first page.
    let back: { remove: () => void } | undefined;
    const added = safely(() =>
      plugins?.App?.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack) history.back();
        else safely(() => plugins.App?.exitApp());
      }),
    ) as Promise<{ remove: () => void }> | undefined;
    if (added && typeof added.then === "function") added.then((l) => (back = l)).catch(() => {});

    // Status bar text follows light/dark mode.
    const syncStatusBar = () => {
      const dark = root.classList.contains("dark");
      safely(() => plugins?.StatusBar?.setStyle({ style: dark ? "DARK" : "LIGHT" }));
      if (safely(() => capacitor()?.getPlatform?.()) === "android") {
        safely(() => plugins?.StatusBar?.setBackgroundColor({ color: dark ? "#0a0f17" : "#ffffff" }));
      }
    };
    syncStatusBar();
    const watch = new MutationObserver(syncStatusBar);
    watch.observe(root, { attributes: true, attributeFilter: ["class"] });

    return () => {
      safely(() => back?.remove());
      watch.disconnect();
    };
  }, []);

  // Phone notifications are switched on from the profile page (PushSetup). Here: open the chat
  // when a notification is tapped, and stop notifications for this phone after logging out.
  useEffect(() => {
    if (!isNativeApp()) return;
    const stored = (() => {
      try {
        return localStorage.getItem(PUSH_TOKEN_KEY);
      } catch {
        return null;
      }
    })();
    if (!stored) return;
    if (!userId) {
      removePushToken(stored).catch(() => {});
      try {
        localStorage.removeItem(PUSH_TOKEN_KEY);
      } catch {}
      return;
    }
    const push = nativePlugin<PushPlugin>("PushNotifications");
    const listeners: { remove: () => void }[] = [];
    const listen = (event: string, cb: (e: never) => void) => {
      const added = safely(() => push?.addListener(event, cb)) as Promise<{ remove: () => void }> | undefined;
      if (added && typeof added.then === "function") added.then((l) => listeners.push(l)).catch(() => {});
    };
    listen("pushNotificationActionPerformed", ((a: { notification?: { data?: { url?: string } } }) => {
      const url = a.notification?.data?.url;
      if (url && url.startsWith("/")) location.href = url;
    }) as (e: never) => void);
    // Phones don't show notifications while the app is open, so show a banner instead
    // (unless that chat is already on screen).
    listen("pushNotificationReceived", ((n: { title?: string; body?: string; data?: { url?: string } }) => {
      const url = n.data?.url;
      if (url && location.pathname === url) return;
      setBanner({ title: n.title || "New message", body: n.body || "", url: url && url.startsWith("/") ? url : "/messages" });
      safely(() => navigator.vibrate?.(200));
    }) as (e: never) => void);
    return () => listeners.forEach((l) => safely(() => l.remove()));
  }, [userId]);

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 6000);
    return () => clearTimeout(t);
  }, [banner]);

  if (!banner) return null;
  return (
    <div className="fixed inset-x-3 top-[calc(0.5rem+env(safe-area-inset-top))] z-[70] mx-auto max-w-md" role="status">
      <a
        href={banner.url}
        onClick={() => setBanner(null)}
        className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-3 shadow-xl"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lagoon-50 text-lagoon-700">
          <MessagesSquare className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink">{banner.title}</span>
          <span className="block truncate text-sm text-muted">{banner.body}</span>
        </span>
      </a>
    </div>
  );
}
