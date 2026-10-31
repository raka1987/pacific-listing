"use client";

import { useEffect } from "react";
import { removePushToken, savePushToken } from "@/app/push-actions";
import { capacitor, isNativeApp, nativePlugin, type NativePlugins, type PushPlugin } from "@/lib/native";

const TOKEN_KEY = "pl_push_token";

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

  // Phone notifications: register this phone for the logged-in member.
  useEffect(() => {
    if (!isNativeApp()) return;
    const push = nativePlugin<PushPlugin>("PushNotifications");
    if (!push) return;
    const stored = (() => {
      try {
        return localStorage.getItem(TOKEN_KEY);
      } catch {
        return null;
      }
    })();
    // Logged out: this phone stops getting the previous member's notifications.
    if (!userId) {
      if (stored) {
        removePushToken(stored).catch(() => {});
        try {
          localStorage.removeItem(TOKEN_KEY);
        } catch {}
      }
      return;
    }

    const listeners: { remove: () => void }[] = [];
    const keep = (p: Promise<{ remove: () => void }> | undefined) => p?.then((l) => listeners.push(l)).catch(() => {});
    keep(
      safely(() =>
        push.addListener("registration", ((t: { value: string }) => {
          try {
            localStorage.setItem(TOKEN_KEY, t.value);
          } catch {}
          savePushToken(t.value, capacitor()?.getPlatform?.() ?? "android").catch(() => {});
        }) as (e: never) => void),
      ) as Promise<{ remove: () => void }> | undefined,
    );
    // Tapping a notification opens the chat it's about.
    keep(
      safely(() =>
        push.addListener("pushNotificationActionPerformed", ((a: { notification?: { data?: { url?: string } } }) => {
          const url = a.notification?.data?.url;
          if (url && url.startsWith("/")) location.href = url;
        }) as (e: never) => void),
      ) as Promise<{ remove: () => void }> | undefined,
    );

    (async () => {
      try {
        await push.createChannel?.({ id: "messages", name: "Messages", description: "New chat messages", importance: 5, vibration: true });
        let perm = await push.checkPermissions();
        if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") perm = await push.requestPermissions();
        if (perm.receive === "granted") await push.register();
      } catch {}
    })();

    return () => listeners.forEach((l) => safely(() => l.remove()));
  }, [userId]);
  return null;
}
