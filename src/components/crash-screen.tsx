"use client";

import { RefreshCw } from "lucide-react";
import { useEffect } from "react";

const RELOAD_KEY = "pl_reloaded_after_update";

/** True when the page's code is out of date because the site was updated while it was open. */
function isStaleCode(error: Error) {
  return /ChunkLoadError|Loading chunk|Loading CSS chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
    `${error.name} ${error.message}`,
  );
}

/** Shown instead of a blank crash. After a site update it reloads by itself, once. */
export function CrashScreen({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
    if (!isStaleCode(error)) return;
    try {
      if (sessionStorage.getItem(RELOAD_KEY)) return;
      sessionStorage.setItem(RELOAD_KEY, "1");
    } catch {}
    window.location.reload();
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 py-16 text-center">
      <div className="max-w-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" className="mx-auto h-14 w-14 rounded-2xl" />
        <h1 className="mt-5 text-2xl font-semibold text-ink">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted">This page didn&apos;t load properly. Reloading usually fixes it.</p>
        <p className="mt-3 text-xs break-words text-faint">
          Error details: {error.message || error.name || "unknown"}
          {error.digest ? ` (${error.digest})` : ""}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => {
              try {
                sessionStorage.removeItem(RELOAD_KEY);
              } catch {}
              window.location.reload();
            }}
            className="btn-primary"
          >
            <RefreshCw className="h-4 w-4" /> Reload
          </button>
          <button onClick={reset} className="btn-secondary">Try again</button>
        </div>
      </div>
    </div>
  );
}

/** Clears the one-time reload flag once a page has loaded fine. */
export function ClearReloadFlag() {
  useEffect(() => {
    try {
      sessionStorage.removeItem(RELOAD_KEY);
    } catch {}
  }, []);
  return null;
}
