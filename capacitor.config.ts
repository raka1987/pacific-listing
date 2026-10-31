import type { CapacitorConfig } from "@capacitor/cli";

// The Pacific Listing phone apps (Android and iPhone).
// They open the live website inside a native app, so every website update
// reaches the apps instantly without publishing a new app version.
const config: CapacitorConfig = {
  appId: "com.pacificlisting.app",
  appName: "Pacific Listing",
  // Small local pages bundled inside the app (shown while starting and when offline).
  webDir: "mobile",
  // Lets the website recognise the app, e.g. to hide "Get the app" prompts.
  appendUserAgent: "PacificListingApp",
  backgroundColor: "#ffffff",
  server: {
    url: "https://www.pacificlisting.com",
    errorPath: "offline.html",
    // Pages the app may open inside itself; everything else (WhatsApp, phone
    // calls, advertisers' websites) opens in the right app or the browser.
    allowNavigation: ["pacificlisting.com", "www.pacificlisting.com", "*.supabase.co"],
  },
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: "never",
    scheme: "Pacific Listing",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#12857f",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
      splashFullScreen: false,
      splashImmersive: false,
    },
    PushNotifications: {
      // On iPhone, still show the notification while the app is open.
      presentationOptions: ["badge", "sound", "alert"],
    },
    StatusBar: {
      overlaysWebView: false,
      style: "DEFAULT",
      backgroundColor: "#ffffff",
    },
  },
};

export default config;
