"use client";

import Link from "next/link";
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { isNativeApp } from "@/lib/native";
import { track } from "@/lib/track";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const KEY = "pl-cookie-consent";

/**
 * Google Analytics and the Facebook Pixel, loaded only after the visitor
 * accepts, and never inside the phone apps. Does nothing when no IDs are set.
 */
export function Analytics() {
  const [consent, setConsent] = useState<"yes" | "no" | null | "unknown">("unknown");
  const pathname = usePathname();
  const search = useSearchParams();

  useEffect(() => {
    if (isNativeApp()) return setConsent("no");
    try {
      const v = localStorage.getItem(KEY);
      setConsent(v === "yes" || v === "no" ? v : null);
    } catch {
      setConsent(null);
    }
  }, []);

  // Page views as people move around the site.
  useEffect(() => {
    if (consent !== "yes") return;
    const w = window as unknown as { gtag?: (...a: unknown[]) => void; fbq?: (...a: unknown[]) => void };
    w.gtag?.("event", "page_view", { page_location: location.href, page_path: pathname });
    w.fbq?.("track", "PageView");
  }, [consent, pathname, search]);

  // Conversions marked in the address after posting an ad or signing up.
  useEffect(() => {
    if (consent !== "yes") return;
    if (search.get("posted")) track("post_ad");
    if (search.get("welcome")) track("sign_up");
    if (search.get("q") && pathname.startsWith("/search")) track("search", { search_term: search.get("q") });
  }, [consent, pathname, search]);

  if (!GA_ID && !PIXEL_ID) return null;

  function choose(v: "yes" | "no") {
    setConsent(v);
    try {
      localStorage.setItem(KEY, v);
    } catch {}
  }

  return (
    <>
      {consent === "yes" && GA_ID && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="ga" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('js',new Date());gtag('config','${GA_ID}',{send_page_view:false});`}</Script>
        </>
      )}
      {consent === "yes" && PIXEL_ID && (
        <Script id="meta-pixel" strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${PIXEL_ID}');`}</Script>
      )}
      {consent === null && (
        <div
          role="dialog"
          aria-label="Cookies"
          className="fixed inset-x-3 bottom-[calc(84px+env(safe-area-inset-bottom))] z-50 mx-auto max-w-xl rounded-2xl border border-line bg-surface p-4 text-sm text-ink-2 shadow-xl sm:bottom-6"
        >
          <p>
            We use cookies to understand how the site is used and to show our ads to people who might like Pacific Listing.{" "}
            <Link href="/privacy" className="underline">
              Privacy policy
            </Link>
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => choose("yes")} className="btn-primary px-4 py-2 text-xs">
              Accept
            </button>
            <button type="button" onClick={() => choose("no")} className="btn-secondary px-4 py-2 text-xs">
              No thanks
            </button>
          </div>
        </div>
      )}
    </>
  );
}
