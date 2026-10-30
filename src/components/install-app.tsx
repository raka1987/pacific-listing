"use client";

import { Check, Download, Share, Smartphone, SquarePlus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { isNativeApp } from "@/lib/native";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    listeners.forEach((l) => l());
  });
}

function useInstall() {
  const [canPrompt, setCanPrompt] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "other">("other");
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const update = () => setCanPrompt(!!deferred);
    update();
    listeners.add(update);
    const ua = navigator.userAgent;
    setPlatform(/iphone|ipad|ipod/i.test(ua) ? "ios" : "other");
    setInstalled(
      isNativeApp() || matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true,
    );
    return () => {
      listeners.delete(update);
    };
  }, []);

  async function install() {
    if (!deferred) return false;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    setCanPrompt(false);
    if (outcome === "accepted") setInstalled(true);
    return true;
  }
  return { canPrompt, platform, installed, install };
}

export function InstallAppCard() {
  const { canPrompt, platform, installed, install } = useInstall();
  const [showIos, setShowIos] = useState(false);
  const [native, setNative] = useState(false);
  useEffect(() => setNative(isNativeApp()), []);
  if (native) return null;

  return (
    <div className="card p-6 sm:p-7">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-lagoon-50 text-lagoon-700">
        <Smartphone className="h-5 w-5" />
      </span>
      <h2 className="font-display mt-4 text-xl font-semibold">Get the app</h2>
      <p className="mt-1.5 max-w-sm text-sm text-muted">
        Add it to your home screen. It opens full-screen, loads fast and uses less data. No app store needed.
      </p>
      <div className="mt-5">
        {installed ? (
          <span className="btn bg-lagoon-50 text-lagoon-700">
            <Check className="h-4 w-4" /> Installed on this device
          </span>
        ) : canPrompt ? (
          <button onClick={install} className="btn-primary">
            <Download className="h-4 w-4" /> Install app
          </button>
        ) : platform === "ios" ? (
          <button onClick={() => setShowIos(true)} className="btn-primary">
            <Download className="h-4 w-4" /> Add to iPhone
          </button>
        ) : (
          <p className="text-sm text-muted">
            Open this site on your phone, then choose <strong>Install app</strong> or <strong>Add to Home screen</strong> from the browser menu.
          </p>
        )}
      </div>
      {showIos && <IosSheet onClose={() => setShowIos(false)} />}
    </div>
  );
}

/** A small, dismissible banner for phones that haven't installed the app yet. */
export function InstallBanner() {
  const { canPrompt, platform, installed, install } = useInstall();
  const [hidden, setHidden] = useState(true);
  const [showIos, setShowIos] = useState(false);

  useEffect(() => {
    try {
      setHidden(!!localStorage.getItem("install-banner-dismissed"));
    } catch {
      setHidden(false);
    }
  }, []);

  if (hidden || installed || (!canPrompt && platform !== "ios")) return null;

  function dismiss() {
    setHidden(true);
    try {
      localStorage.setItem("install-banner-dismissed", "1");
    } catch {}
  }

  return (
    <>
      <div className="fixed inset-x-3 bottom-[calc(76px+env(safe-area-inset-bottom))] z-40 flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-xl sm:hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" className="h-10 w-10 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink">Pacific Listing app</p>
          <p className="truncate text-xs text-muted">Faster, full-screen, less data</p>
        </div>
        <button onClick={() => (canPrompt ? install() : setShowIos(true))} className="btn-primary px-4 py-2 text-xs">
          Install
        </button>
        <button onClick={dismiss} className="p-1 text-faint" aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      </div>
      {showIos && <IosSheet onClose={() => setShowIos(false)} />}
    </>
  );
}

function IosSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Install on iPhone">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-t-3xl bg-surface p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-ink">
        <button onClick={onClose} className="absolute top-4 right-4 text-faint" aria-label="Close">
          <X className="h-5 w-5" />
        </button>
        <h2 className="font-display text-xl font-semibold">Add to your iPhone</h2>
        <ol className="mt-4 space-y-3 text-sm text-ink-2">
          <li className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-subtle"><Share className="h-4 w-4" /></span>
            Tap the <strong>Share</strong> button at the bottom of Safari.
          </li>
          <li className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-subtle"><SquarePlus className="h-4 w-4" /></span>
            Scroll down and tap <strong>Add to Home Screen</strong>.
          </li>
          <li className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-subtle"><Check className="h-4 w-4" /></span>
            Tap <strong>Add</strong>. Pacific Listing will appear with your apps.
          </li>
        </ol>
        <button onClick={onClose} className="btn-primary mt-6 w-full">Got it</button>
      </div>
    </div>
  );
}
