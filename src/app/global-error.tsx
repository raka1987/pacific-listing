"use client";

import "./globals.css";
import { CrashScreen } from "@/components/crash-screen";

// Last resort when the whole page fails to start.
export default function GlobalError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="bg-canvas text-ink">
        <CrashScreen {...props} />
      </body>
    </html>
  );
}
