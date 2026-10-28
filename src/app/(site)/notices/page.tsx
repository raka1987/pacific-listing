import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { ContentPage } from "@/components/content-page";
import { EmptyState } from "@/components/empty-state";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Notice } from "@/lib/types";

export const metadata: Metadata = { title: "Notice board", description: "Community news and announcements from Pacific Listing." };

export default async function NoticesPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("notices").select("*").eq("is_published", true).order("created_at", { ascending: false });
  const notices = (data ?? []) as Notice[];
  return (
    <ContentPage title="Community notice board" intro="News, events and announcements.">
      {notices.length ? (
        <div className="space-y-4">
          {notices.map((n) => (
            <article key={n.id} id={n.id} className="card scroll-mt-24 p-6">
              <p className="text-xs font-semibold tracking-wide text-lagoon-700 uppercase">{formatDate(n.created_at)}</p>
              <h2 className="mt-1 text-lg font-bold text-slate-900">{n.title}</h2>
              <p className="mt-2 whitespace-pre-line text-slate-600">{n.body}</p>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState icon={Bell} title="No notices right now" description="Check back soon for community news." />
      )}
    </ContentPage>
  );
}
