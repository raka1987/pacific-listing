import type { Metadata } from "next";
import Link from "next/link";
import { Globe2, HeartHandshake, ShieldCheck, Smartphone } from "lucide-react";
import { ContentPage } from "@/components/content-page";

export const metadata: Metadata = {
  title: "About us",
  description: "Pacific Listing is a free, local marketplace connecting buyers and sellers across the Pacific Islands.",
};

const VALUES = [
  { icon: Globe2, title: "Built for the Pacific", text: "Local currencies, island locations and the way people here actually buy and sell — by phone and WhatsApp." },
  { icon: HeartHandshake, title: "Free for everyone", text: "Posting an ad is free. We want every household and small business to have a place to sell." },
  { icon: ShieldCheck, title: "Safe & moderated", text: "Our team reviews reported ads and removes scams, so you can trade with confidence." },
  { icon: Smartphone, title: "Fast on any phone", text: "Light pages and compressed photos that load quickly, even on slower mobile data." },
];

export default function AboutPage() {
  return (
    <ContentPage title="About Pacific Listing" intro="A home-grown marketplace for island communities.">
      <div className="prose-simple">
        <p>
          Pacific Listing makes it easy to buy, sell and find what you need across Fiji, Samoa, Tonga, Vanuatu, the Solomon
          Islands, Papua New Guinea and the wider Pacific. From cars and houses to jobs, services, boats and everyday
          household goods — if it&apos;s for sale in the islands, it belongs here.
        </p>
        <p>
          We started Pacific Listing because buying and selling in the Pacific too often relies on scattered social media
          posts that disappear in a day. We wanted one trusted, searchable place where good deals can be found by the people
          who need them.
        </p>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {VALUES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="card p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-lagoon-50 text-lagoon-700">
              <Icon className="h-5 w-5" />
            </span>
            <h2 className="mt-3 font-bold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{text}</p>
          </div>
        ))}
      </div>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/post" className="btn-accent">Post a free ad</Link>
        <Link href="/contact" className="btn-secondary">Get in touch</Link>
      </div>
    </ContentPage>
  );
}
