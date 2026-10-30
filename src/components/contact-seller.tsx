"use client";

import { Mail, MessageCircle, Phone } from "lucide-react";
import { useState } from "react";
import { phoneDigits } from "@/lib/format";
import { track } from "@/lib/track";

export function ContactSeller({
  phone,
  whatsapp,
  title,
  listingUrl,
}: {
  phone: string | null;
  whatsapp: string | null;
  title: string;
  listingUrl: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const message = encodeURIComponent(`Hi! Is "${title}" still available? (seen on Pacific Listing: ${listingUrl})`);

  if (!phone && !whatsapp) {
    return (
      <p className="rounded-xl bg-subtle p-3 text-sm text-muted">
        The seller hasn&apos;t added contact details to this ad.
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
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
          <a onClick={() => track("contact_seller", { method: "phone" })} href={`tel:${phone.replace(/\s/g, "")}`} className="btn-primary w-full py-3">
            <Phone className="h-5 w-5" /> {phone}
          </a>
        ) : (
          <button onClick={() => setRevealed(true)} className="btn-primary w-full py-3">
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
