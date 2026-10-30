// Sends a marketing event to Google Analytics and the Facebook Pixel, if they're switched on.
type Gtag = (...args: unknown[]) => void;
type Fbq = (...args: unknown[]) => void;

const META_EVENTS: Record<string, string> = {
  sign_up: "CompleteRegistration",
  post_ad: "Lead",
  contact_seller: "Contact",
  search: "Search",
};

export function track(event: string, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const w = window as unknown as { gtag?: Gtag; fbq?: Fbq };
  w.gtag?.("event", event, params);
  if (w.fbq) {
    const standard = META_EVENTS[event];
    if (standard) w.fbq("track", standard, params);
    else w.fbq("trackCustom", event, params);
  }
}
