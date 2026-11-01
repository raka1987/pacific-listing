"use client";

import { Check, Lock, MessageCircle, Phone } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ListingContact } from "@/lib/contact";
import { phoneDigits } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { track } from "@/lib/track";

export type ChatNumbers = {
  role: "buyer" | "seller";
  listingId: string;
  contact: ListingContact | null;
  /** Seller side: when they shared their number in this chat. */
  sharedAt: string | null;
};

export const ASK_FOR_NUMBER = "Hi, could you share your phone number with me?";

/** The strip under the ad in a chat: the buyer asks for the seller's private number, the seller shares it. */
export function ChatNumbersStrip({
  conversationId,
  numbers,
  messageCount,
  onAsk,
  asked,
}: {
  conversationId: string;
  numbers: ChatNumbers;
  /** Changes whenever a message arrives, so the buyer's view picks up a shared number straight away. */
  messageCount: number;
  onAsk: () => void;
  asked: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [contact, setContact] = useState(numbers.contact);
  const [sharedAt, setSharedAt] = useState(numbers.sharedAt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const buyerWaiting = numbers.role === "buyer" && contact?.private && !contact.visible;

  useEffect(() => {
    if (!buyerWaiting || messageCount === 0) return;
    supabase.rpc("get_listing_contact", { p_listing: numbers.listingId }).then(({ data }) => {
      if (data) setContact(data as ListingContact);
    });
  }, [buyerWaiting, messageCount, supabase, numbers.listingId]);

  if (!contact) return null;
  const strip = "flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-surface px-3 py-2 text-sm sm:px-4";

  if (numbers.role === "seller") {
    if (!contact.private) return null;
    if (sharedAt) {
      return (
        <div className={`${strip} text-muted`}>
          <Check className="h-4 w-4 text-lagoon-600" /> You&apos;ve shared your number with this buyer.
        </div>
      );
    }
    const share = async () => {
      setBusy(true);
      setError("");
      const { error } = await supabase.rpc("share_my_number", { cid: conversationId });
      setBusy(false);
      if (error) return setError(error.message);
      setSharedAt(new Date().toISOString());
      track("share_number");
    };
    return (
      <div className={strip}>
        <Lock className="h-4 w-4 shrink-0 text-muted" />
        <span className="min-w-0 flex-1 text-ink-2">Your number is hidden from this buyer.</span>
        <button type="button" onClick={share} disabled={busy} className="btn-secondary px-3 py-1.5 text-sm">
          <Phone className="h-4 w-4" /> {busy ? "Sharing…" : "Share my number"}
        </button>
        {error && <p className="w-full text-xs text-coral-600">{error}</p>}
      </div>
    );
  }

  // Buyer
  if (contact.visible) {
    if (!contact.phone && !contact.whatsapp) return null;
    const num = contact.phone || contact.whatsapp!;
    return (
      <div className={strip}>
        <Phone className="h-4 w-4 shrink-0 text-lagoon-600" />
        <span className="min-w-0 flex-1 font-semibold text-ink select-all">{num}</span>
        {contact.phone && (
          <a href={`tel:${contact.phone.replace(/\s/g, "")}`} onClick={() => track("contact_seller", { method: "phone" })} className="btn-secondary px-3 py-1.5 text-sm">
            Call
          </a>
        )}
        {contact.whatsapp && (
          <a
            href={`https://wa.me/${phoneDigits(contact.whatsapp)}`}
            onClick={() => track("contact_seller", { method: "whatsapp" })}
            target="_blank"
            rel="noopener noreferrer"
            className="btn bg-[#25D366] px-3 py-1.5 text-sm text-white hover:bg-[#1ebe5b]"
          >
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
        )}
      </div>
    );
  }
  return (
    <div className={strip}>
      <Lock className="h-4 w-4 shrink-0 text-muted" />
      <span className="min-w-0 flex-1 text-ink-2">
        <span className="font-semibold tracking-wide text-ink">{contact.masked_phone || contact.masked_whatsapp}</span> · The seller&apos;s number is private.
      </span>
      <button type="button" onClick={onAsk} disabled={asked} className="btn-secondary px-3 py-1.5 text-sm">
        {asked ? "Asked" : "Ask for number"}
      </button>
    </div>
  );
}
