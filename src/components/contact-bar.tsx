"use client";

import { MessageCircle, Phone } from "lucide-react";
import { phoneDigits } from "@/lib/format";
import { track } from "@/lib/track";
import { ChatButton } from "./chat-button";

/** Sticky contact buttons at the bottom of the screen on phones. */
export function ContactBar({
  listingId,
  price,
  phone,
  whatsapp,
  title,
  listingUrl,
}: {
  listingId: string;
  price: string;
  phone: string | null;
  whatsapp: string | null;
  title: string;
  listingUrl: string;
}) {
  const message = encodeURIComponent(`Hi! Is "${title}" still available? (seen on Pacific Listing: ${listingUrl})`);
  return (
    <div className="glass fixed inset-x-0 bottom-0 z-40 border-t border-line px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:hidden">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg leading-tight font-semibold text-ink">{price}</p>
          <p className="truncate text-xs text-muted">{title}</p>
        </div>
        {phone && (
          <a onClick={() => track("contact_seller", { method: "phone" })} href={`tel:${phone.replace(/\s/g, "")}`} className="btn-secondary h-11 w-11 p-0" aria-label="Call seller">
            <Phone className="h-5 w-5" />
          </a>
        )}
        {whatsapp && (
          <a
            href={`https://wa.me/${phoneDigits(whatsapp)}?text=${message}`}
            onClick={() => track("contact_seller", { method: "whatsapp" })}
            target="_blank"
            rel="noopener noreferrer"
            className="btn h-11 w-11 bg-[#25D366] p-0 text-white shadow-md shadow-[#25D366]/30 hover:bg-[#1ebe5b]"
            aria-label="WhatsApp seller"
          >
            <MessageCircle className="h-5 w-5" />
          </a>
        )}
        <ChatButton listingId={listingId} label="Chat" className="btn-primary h-11 px-5 shadow-md" />
      </div>
    </div>
  );
}
