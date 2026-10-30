"use client";

import { MessagesSquare } from "lucide-react";
import { useState, useTransition } from "react";
import { startChat } from "@/app/chat-actions";

/** Opens the in-app chat with the seller of an ad. */
export function ChatButton({ listingId, className, label = "Chat with seller" }: { listingId: string; className: string; label?: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await startChat(listingId);
            if (res?.error) setError(res.error);
          })
        }
        className={className}
      >
        <MessagesSquare className="h-5 w-5" /> {pending ? "Opening…" : label}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </>
  );
}
