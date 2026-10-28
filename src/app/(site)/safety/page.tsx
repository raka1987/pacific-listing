import type { Metadata } from "next";
import { AlertTriangle, Banknote, Eye, Flag, Lock, Users } from "lucide-react";
import { ContentPage } from "@/components/content-page";

export const metadata: Metadata = { title: "Safety tips", description: "How to buy and sell safely on Pacific Listing." };

const TIPS = [
  { icon: Users, title: "Meet in public", text: "Meet in a busy, well-lit place like a shopping centre or outside a police station. Bring a friend for big purchases." },
  { icon: Eye, title: "Inspect before you pay", text: "Check the item works and matches the ad. For vehicles, check the papers and registration match the seller." },
  { icon: Banknote, title: "Never pay in advance", text: "Don't send deposits, M-PAiSA, bank transfers or gift cards to someone you haven't met for an item you haven't seen." },
  { icon: AlertTriangle, title: "Watch for red flags", text: "Prices that look too good, sellers who are 'overseas', pressure to act fast, or requests to move off WhatsApp to strange links." },
  { icon: Lock, title: "Protect your details", text: "Never share passwords, PINs or one-time codes. Pacific Listing will never ask for them." },
  { icon: Flag, title: "Report suspicious ads", text: "Use the 'Report this ad' link on any listing. Our team reviews every report." },
];

export default function SafetyPage() {
  return (
    <ContentPage title="Stay safe when buying & selling" intro="Most people are honest, but a few simple habits keep you protected.">
      <div className="grid gap-4 sm:grid-cols-2">
        {TIPS.map(({ icon: Icon, title, text }) => (
          <div key={title} className="card p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <Icon className="h-5 w-5" />
            </span>
            <h2 className="mt-3 font-bold text-ink">{title}</h2>
            <p className="mt-1 text-sm text-ink-2">{text}</p>
          </div>
        ))}
      </div>
    </ContentPage>
  );
}
