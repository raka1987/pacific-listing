import type { Metadata } from "next";
import { Clock, Mail } from "lucide-react";
import { ContentPage } from "@/components/content-page";
import { getCurrentUser } from "@/lib/auth";
import { SITE } from "@/lib/constants";
import { ContactForm } from "./form";

export const metadata: Metadata = { title: "Contact & feedback", description: "Get help or send feedback to the Pacific Listing team." };

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ subject?: string }> }) {
  const current = await getCurrentUser();
  const { subject } = await searchParams;
  return (
    <ContentPage title="Contact & feedback" intro="Questions, problems or ideas to make Pacific Listing better? We'd love to hear from you.">
      <div className="grid gap-6 md:grid-cols-[1fr_260px]">
        <ContactForm name={current?.profile?.full_name} email={current?.user.email} subject={subject} />
        <div className="space-y-4">
          <div className="card p-5">
            <Mail className="h-5 w-5 text-lagoon-600" />
            <h2 className="mt-2 font-bold">Email</h2>
            <a href={`mailto:${SITE.supportEmail}`} className="text-sm break-all text-lagoon-700 hover:underline">{SITE.supportEmail}</a>
          </div>
          <div className="card p-5">
            <Clock className="h-5 w-5 text-lagoon-600" />
            <h2 className="mt-2 font-bold">Response time</h2>
            <p className="text-sm text-muted">Usually within 1–2 working days.</p>
          </div>
        </div>
      </div>
    </ContentPage>
  );
}
