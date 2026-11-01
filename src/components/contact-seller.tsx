"use client";

import { Lock, Mail, MessageCircle, Phone } from "lucide-react";
import { useState } from "react";
import { phoneDigits } from "@/lib/format";
import { track } from "@/lib/track";
import { ChatButton } from "./chat-button";

export function ContactSeller({
  listingId,
  phone,
  whatsapp,
  maskedPhone = null,
  title,
  listingUrl,
}: {
  listingId: string;
  phone: string | null;
  whatsapp: string | null;
  /** Set when the seller keeps their number private: only part of it is shown. */
  maskedPhone?: string | null;
  title: string;
  listingUrl: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const message = encodeURIComponent(`Hi! Is "${title}" still available? (seen on Pacific Listing: ${listingUrl})`);

  return (
    <div className="space-y-2.5">
      <ChatButton listingId={listingId} className="btn-primary w-full py-3" />
      {maskedPhone && (
        <div className="flex items-center gap-3 rounded-xl border border-line px-4 py-2.5">
          <Lock className="h-4 w-4 shrink-0 text-muted" />
          <div className="min-w-0 text-sm">
            <p className="font-semibold tracking-wide text-ink">{maskedPhone}</p>
            <p className="text-xs text-muted">The seller keeps their number private. Ask for it in the chat.</p>
          </div>
        </div>
      )}
      {whatsapp && (
        <a
          href={`https://wa.me/${phoneDigits(whatsapp)}?text=${message}`}
          onClick={() => track("contact_seller", { method: "whatsapp" })}
          target="_blank"
          rel="noopener noreferrer"
          className="btn w-full bg-[#25D366] py-3 text-white hover:bg-[#1ebe5b]"
        >
          <MessageCircle className="h-5 w-5" /> Chat on WhatsApp
        </a>
      )}
      {phone &&
        (revealed ? (
          <a onClick={() => track("contact_seller", { method: "phone" })} href={`tel:${phone.replace(/\s/g, "")}`} className="btn-secondary w-full py-3">
            <Phone className="h-5 w-5" /> {phone}
          </a>
        ) : (
          <button onClick={() => setRevealed(true)} className="btn-secondary w-full py-3">
            <Phone className="h-5 w-5" /> Show phone number
          </button>
        ))}
      {phone && (
        <a href={`sms:${phone.replace(/\s/g, "")}?body=${message}`} className="btn-secondary w-full">
          <Mail className="h-4 w-4" /> Send a text
        </a>
      )}
    </div>
  );
}
