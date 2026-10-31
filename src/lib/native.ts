// Helpers for when the site is running inside the Pacific Listing phone app.
// The app shell injects window.Capacitor and adds "PacificListingApp" to the user agent.

type Listener = { remove: () => void };
export type NativePlugins = {
  App?: {
    addListener: (event: "backButton", cb: (e: { canGoBack: boolean }) => void) => Promise<Listener>;
    exitApp: () => Promise<void>;
  };
  StatusBar?: {
    setStyle: (o: { style: "DARK" | "LIGHT" }) => Promise<void>;
    setBackgroundColor: (o: { color: string }) => Promise<void>;
  };
};

export type PushPlugin = {
  checkPermissions: () => Promise<{ receive: string }>;
  requestPermissions: () => Promise<{ receive: string }>;
  register: () => Promise<void>;
  createChannel?: (c: { id: string; name: string; description?: string; importance?: number; sound?: string; vibration?: boolean }) => Promise<void>;
  addListener: (event: string, cb: (e: never) => void) => Promise<Listener>;
};

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  isPluginAvailable?: (name: string) => boolean;
  registerPlugin?: (name: string) => unknown;
  Plugins?: NativePlugins & Record<string, unknown>;
};

export function capacitor(): CapacitorGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

export function isNativeApp() {
  if (typeof window === "undefined") return false;
  return !!capacitor()?.isNativePlatform?.() || navigator.userAgent.includes("PacificListingApp");
}

/** A phone feature by name, or undefined when this app version doesn't have it. */
export function nativePlugin<T>(name: string): T | undefined {
  const cap = capacitor();
  if (!cap) return undefined;
  try {
    if (cap.isPluginAvailable && !cap.isPluginAvailable(name)) return undefined;
    return (cap.Plugins?.[name] ?? cap.registerPlugin?.(name)) as T | undefined;
  } catch {
    return undefined;
  }
}
