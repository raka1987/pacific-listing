"use client";

import { useEffect } from "react";
import { capacitor, isNativeApp } from "@/lib/native";

/** Makes the website behave like an app when opened inside the phone apps. */
export function NativeApp() {
  useEffect(() => {
    if (!isNativeApp()) return;
    const root = document.documentElement;
    root.classList.add("native-app");
    const plugins = capacitor()?.Plugins;

    // Android back button: go back a page, or close the app from the first page.
    let back: { remove: () => void } | undefined;
    plugins?.App?.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) history.back();
      else plugins.App?.exitApp();
    }).then((l) => (back = l));

    // Status bar text follows light/dark mode.
    const syncStatusBar = () => {
      const dark = root.classList.contains("dark");
      plugins?.StatusBar?.setStyle({ style: dark ? "DARK" : "LIGHT" }).catch(() => {});
      if (capacitor()?.getPlatform?.() === "android") {
        plugins?.StatusBar?.setBackgroundColor({ color: dark ? "#0a0f17" : "#ffffff" }).catch(() => {});
      }
    };
    syncStatusBar();
    const watch = new MutationObserver(syncStatusBar);
    watch.observe(root, { attributes: true, attributeFilter: ["class"] });

    return () => {
      back?.remove();
      watch.disconnect();
    };
  }, []);
  return null;
}
