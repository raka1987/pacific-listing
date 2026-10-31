"use client";

import { CrashScreen } from "@/components/crash-screen";

export default function SiteError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <CrashScreen {...props} />;
}
