"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * A thin bar across the top that starts the moment a link is tapped, so the
 * site responds instantly even while the next page is still loading.
 */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const giveUp = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A new page has arrived: finish the bar and fade it out.
  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    if (giveUp.current) clearTimeout(giveUp.current);
    timer.current = null;
    setWidth((w) => (w > 0 ? 100 : 0));
    const t = setTimeout(() => {
      setVisible(false);
      setWidth(0);
    }, 250);
    return () => clearTimeout(t);
  }, [pathname, search]);

  useEffect(() => {
    function start() {
      if (timer.current) return;
      setVisible(true);
      setWidth(12);
      // Creep towards 90% while waiting.
      timer.current = setInterval(() => setWidth((w) => (w < 90 ? w + (90 - w) * 0.12 : w)), 200);
      // If no new page arrives (the click didn't navigate after all), finish quietly.
      if (giveUp.current) clearTimeout(giveUp.current);
      giveUp.current = setTimeout(() => {
        if (timer.current) clearInterval(timer.current);
        timer.current = null;
        setVisible(false);
        setWidth(0);
      }, 10000);
    }
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element).closest("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || /^(mailto|tel|sms):/.test(href)) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      start();
    }
    function onSubmit(e: SubmitEvent) {
      const form = e.target as HTMLFormElement;
      // Only forms that load another page: search boxes, and forms with a real address to go to.
      // (A form without one, like sending a chat message, has method "get" by default but stays put.)
      if (form.getAttribute("role") === "search" || (form.method.toLowerCase() === "get" && form.hasAttribute("action"))) start();
    }
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]">
      <div
        className="h-full bg-lagoon-500 shadow-[0_0_8px_rgba(26,166,156,0.6)] transition-[width,opacity] duration-200 ease-out"
        style={{ width: `${width}%`, opacity: visible ? 1 : 0 }}
      />
    </div>
  );
}
