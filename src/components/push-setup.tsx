"use client";

import { BellRing, CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { savePushToken } from "@/app/push-actions";
import { capacitor, isNativeApp, nativePlugin, type PushPlugin } from "@/lib/native";

export const PUSH_TOKEN_KEY = "pl_push_token";
const STEP_KEY = "pl_push_step";

const STEPS = [
  "Getting ready",
  "Setting up the Messages channel",
  "Checking permission",
  "Asking for permission",
  "Registering this phone with Google",
  "Waiting for Google's reply",
  "Saving",
];

const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
  del: (k: string) => {
    try {
      localStorage.removeItem(k);
    } catch {}
  },
};

/**
 * "Turn on phone notifications" in the app's profile page. Each step is remembered before it
 * runs, so if the app ever closes during setup, the next visit says exactly where it stopped.
 */
export function PushSetup({ account }: { account: string }) {
  const [available, setAvailable] = useState(false);
  const [oldApp, setOldApp] = useState(false);
  const [on, setOn] = useState(false);
  const [step, setStep] = useState(-1);
  const [stoppedAt, setStoppedAt] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isNativeApp()) return;
    if (!nativePlugin<PushPlugin>("PushNotifications")) return setOldApp(true);
    setAvailable(true);
    const last = store.get(STEP_KEY);
    if (last) setStoppedAt(last);
    // Re-save the phone each visit, so "On" is only shown when the server really has it.
    const token = store.get(PUSH_TOKEN_KEY);
    if (!token) return;
    savePushToken(token, capacitor()?.getPlatform?.() ?? "android")
      .then((r) => {
        if (r?.error) {
          setError(`Notifications aren't working yet: ${r.error}. Tap the button to set them up again.`);
          setOn(false);
        } else setOn(true);
      })
      .catch(() => setOn(false));
  }, []);

  if (oldApp) {
    return (
      <section className="card mt-6 p-5">
        <h2 className="flex items-center gap-2 font-bold text-ink">
          <BellRing className="h-4 w-4 text-lagoon-600" /> Phone notifications
        </h2>
        <p className="mt-2 text-sm text-ink-2">
          This version of the app can&apos;t do notifications yet. Update Pacific Listing in the Play Store, then come back here.
        </p>
      </section>
    );
  }
  if (!available) return null;

  async function run() {
    const push = nativePlugin<PushPlugin>("PushNotifications")!;
    setError("");
    setStoppedAt(null);
    let current = 0;
    const mark = (i: number) => {
      current = i;
      setStep(i);
      store.set(STEP_KEY, `${i + 1}. ${STEPS[i]} (${new Date().toLocaleString()})`);
    };
    const pause = () => new Promise((r) => setTimeout(r, 150));
    try {
      mark(0);
      await pause();
      const token = new Promise<string>((resolve, reject) => {
        push.addListener("registration", ((t: { value: string }) => resolve(t.value)) as (e: never) => void);
        push.addListener("registrationError", ((e: { error: string }) => reject(new Error(e.error || "Google refused"))) as (e: never) => void);
        setTimeout(() => reject(new Error("Google didn't reply within 30 seconds")), 30000);
      });

      mark(1);
      await pause();
      await push.createChannel?.({ id: "messages", name: "Messages", description: "New chat messages", importance: 4, vibration: true });

      mark(2);
      await pause();
      let perm = await push.checkPermissions();

      if (perm.receive !== "granted") {
        mark(3);
        await pause();
        perm = await push.requestPermissions();
      }
      if (perm.receive !== "granted") {
        store.del(STEP_KEY);
        setStep(-1);
        setError("Notifications are blocked for this app. Turn them on in your phone's Settings > Apps > Pacific Listing > Notifications, then try again.");
        return;
      }

      mark(4);
      await pause();
      await push.register();

      mark(5);
      const value = await token;

      mark(6);
      const saved = await savePushToken(value, capacitor()?.getPlatform?.() ?? "android");
      if (saved?.error) throw new Error(saved.error);
      store.set(PUSH_TOKEN_KEY, value);
      store.del(STEP_KEY);
      setStep(-1);
      setOn(true);
    } catch (e) {
      store.del(STEP_KEY);
      setError(`Step ${current + 1} (${STEPS[current]}) didn't work: ${(e as Error)?.message || e}`);
      setStep(-1);
    }
  }

  return (
    <section className="card mt-6 p-5">
      <h2 className="flex items-center gap-2 font-bold text-ink">
        <BellRing className="h-4 w-4 text-lagoon-600" /> Phone notifications
      </h2>
      {on ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-lagoon-700">
          <CheckCircle2 className="h-4 w-4" /> On for {account}. This phone buzzes when you get a new message.
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted">Get a notification on this phone when someone messages {account}.</p>
      )}
      {stoppedAt && (
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          Last time the app closed during step <strong>{stoppedAt}</strong>. Please tell the Pacific Listing team this step.
        </p>
      )}
      {step >= 0 && (
        <p className="mt-3 flex items-center gap-2 text-sm text-ink-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Step {step + 1} of {STEPS.length}: {STEPS[step]}…
        </p>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <button onClick={run} disabled={step >= 0} className="btn-primary mt-4">
        {on ? "Set up again" : "Turn on phone notifications"}
      </button>
    </section>
  );
}
