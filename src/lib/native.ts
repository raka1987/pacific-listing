// Helpers for when the site is running inside the Pacific Listing phone app.
// The app shell injects window.Capacitor and adds "PacificListingApp" to the user agent.

type Listener = { remove: () => void };
type NativePlugins = {
  App?: {
    addListener: (event: "backButton", cb: (e: { canGoBack: boolean }) => void) => Promise<Listener>;
    exitApp: () => Promise<void>;
  };
  StatusBar?: {
    setStyle: (o: { style: "DARK" | "LIGHT" }) => Promise<void>;
    setBackgroundColor: (o: { color: string }) => Promise<void>;
  };
};

type CapacitorGlobal = { isNativePlatform?: () => boolean; getPlatform?: () => string; Plugins?: NativePlugins };

export function capacitor(): CapacitorGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

export function isNativeApp() {
  if (typeof window === "undefined") return false;
  return !!capacitor()?.isNativePlatform?.() || navigator.userAgent.includes("PacificListingApp");
}
