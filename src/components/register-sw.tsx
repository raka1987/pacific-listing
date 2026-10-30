"use client";

import { useEffect } from "react";
import { isNativeApp } from "@/lib/native";

export function RegisterServiceWorker() {
  useEffect(() => {
    // The phone apps handle offline themselves, so the web worker is only for browsers.
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator && !isNativeApp()) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
