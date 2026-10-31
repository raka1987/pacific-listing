"use client";

import { CrashScreen } from "@/components/crash-screen";

export default function AdminError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <CrashScreen {...props} />;
}
