"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/** Tells the server a page was opened, for the admin Traffic page. */
export function PageView() {
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    // Only the first page carries where the visitor came from (Google, Facebook…).
    const referrer = first.current ? document.referrer : "";
    first.current = false;
    const body = JSON.stringify({ path: pathname, referrer });
    try {
      if (!navigator.sendBeacon?.("/api/view", new Blob([body], { type: "text/plain" }))) {
        fetch("/api/view", { method: "POST", body, keepalive: true }).catch(() => {});
      }
    } catch {}
  }, [pathname]);
  return null;
}
