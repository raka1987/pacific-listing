// Switching on phone notifications in the app (used by the Profile button and automatically after login).
import { savePushToken } from "@/app/push-actions";
import { capacitor, nativePlugin, type PushPlugin } from "./native";

export const PUSH_TOKEN_KEY = "pl_push_token";
/** Set before each step and cleared at the end, so a crash can be spotted on the next start. */
export const PUSH_STEP_KEY = "pl_push_step";
/** Set once the app has tried by itself, so it never tries automatically twice. */
export const PUSH_AUTO_KEY = "pl_push_auto_tried";

export const PUSH_STEPS = [
  "Getting ready",
  "Setting up the Messages channel",
  "Checking permission",
  "Asking for permission",
  "Registering this phone with Google",
  "Waiting for Google's reply",
  "Saving",
];

export const pushStore = {
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

export type PushResult = { ok: true } | { ok: false; denied?: boolean; step: number; error: string };

/** Runs every step, remembering each one first. Never throws. */
export async function runPushSetup(onStep?: (i: number) => void): Promise<PushResult> {
  const push = nativePlugin<PushPlugin>("PushNotifications");
  if (!push) return { ok: false, step: 0, error: "This version of the app can't do notifications. Update it in the Play Store." };
  let current = 0;
  const mark = (i: number) => {
    current = i;
    onStep?.(i);
    pushStore.set(PUSH_STEP_KEY, `${i + 1}. ${PUSH_STEPS[i]} (${new Date().toLocaleString()})`);
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
      pushStore.del(PUSH_STEP_KEY);
      return {
        ok: false,
        denied: true,
        step: current,
        error: "Notifications are blocked for this app. Turn them on in your phone's Settings > Apps > Pacific Listing > Notifications, then try again.",
      };
    }

    mark(4);
    await pause();
    await push.register();

    mark(5);
    const value = await token;

    mark(6);
    const saved = await savePushToken(value, capacitor()?.getPlatform?.() ?? "android");
    if (saved?.error) throw new Error(saved.error);
    pushStore.set(PUSH_TOKEN_KEY, value);
    pushStore.del(PUSH_STEP_KEY);
    return { ok: true };
  } catch (e) {
    pushStore.del(PUSH_STEP_KEY);
    return { ok: false, step: current, error: `Step ${current + 1} (${PUSH_STEPS[current]}) didn't work: ${(e as Error)?.message || e}` };
  }
}
