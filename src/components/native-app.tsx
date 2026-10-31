"use client";

import { useEffect } from "react";
import { capacitor, isNativeApp } from "@/lib/native";

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
export function NativeApp() {
  useEffect(() => {
    if (!isNativeApp()) return;
    const root = document.documentElement;
    root.classList.add("native-app");
    const plugins = capacitor()?.Plugins;

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
  return null;
}
