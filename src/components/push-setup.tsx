"use client";

import { BellRing, CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { removePushToken, savePushToken } from "@/app/push-actions";
import { capacitor, isNativeApp, nativePlugin, type PushPlugin } from "@/lib/native";
import { PUSH_AUTO_KEY, PUSH_STEP_KEY as STEP_KEY, PUSH_STEPS as STEPS, PUSH_TOKEN_KEY, pushStore as store, runPushSetup } from "@/lib/push-flow";

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
    setError("");
    setStoppedAt(null);
    store.set(PUSH_AUTO_KEY, "1");
    const result = await runPushSetup(setStep);
    setStep(-1);
    if (result.ok) setOn(true);
    else setError(result.error);
  }

  async function turnOff() {
    const token = store.get(PUSH_TOKEN_KEY);
    // Remember the choice, so the app never switches them back on by itself.
    store.set(PUSH_AUTO_KEY, "off");
    store.del(PUSH_TOKEN_KEY);
    setOn(false);
    setError("");
    if (token) await removePushToken(token).catch(() => {});
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
      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={run} disabled={step >= 0} className={on ? "btn-secondary" : "btn-primary"}>
          {on ? "Set up again" : "Turn on phone notifications"}
        </button>
        {on && (
          <button onClick={turnOff} className="btn-ghost text-red-600">
            Turn off on this phone
          </button>
        )}
      </div>
    </section>
  );
}
