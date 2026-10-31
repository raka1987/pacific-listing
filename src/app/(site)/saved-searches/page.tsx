import type { Metadata } from "next";
import Link from "next/link";
import { Bell, BellOff, Search, Trash2 } from "lucide-react";
import { deleteSavedSearch, setSearchAlerts } from "@/app/alerts-actions";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { requireUser } from "@/lib/auth";
import { describeSearch, searchHref, type SavedSearch } from "@/lib/saved-search";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Saved searches", robots: { index: false } };

export default async function SavedSearchesPage() {
  const { user } = await requireUser("/saved-searches");
  const supabase = await createClient();
  const [{ data }, { data: prefs }] = await Promise.all([
    supabase.from("saved_searches").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.rpc("get_my_notify_prefs"),
  ]);
  const searches = (data ?? []) as SavedSearch[];
  const emailsOff = prefs && !(prefs as { alerts: boolean }).alerts;
  const iconBtn = "flex h-9 w-9 items-center justify-center rounded-full text-ink-2 hover:bg-subtle";

  return (
    <div className="container-page max-w-3xl py-8">
      <PageHeader
        title="Saved searches"
        description="We'll email you once a day when new ads match. Save a search from any results page."
        action={<Link href="/favorites" className="btn-secondary">Saved ads</Link>}
      />
      {emailsOff && (
        <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          Alert emails are switched off. <Link href="/profile" className="font-semibold underline">Turn them on in your profile</Link>.
        </p>
      )}
      {searches.length ? (
        <ul className="card divide-y divide-line p-0">
          {searches.map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-4 py-3.5">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${s.alerts ? "bg-lagoon-50 text-lagoon-700" : "bg-subtle text-faint"}`}>
                {s.alerts ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
              </span>
              <Link href={searchHref(s)} className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink hover:underline">{describeSearch(s)}</p>
                <p className="text-xs text-muted">{s.alerts ? "Email alerts on" : "Email alerts off"}</p>
              </Link>
              <form action={setSearchAlerts.bind(null, s.id, !s.alerts)}>
                <SubmitButton className={iconBtn}>
                  {s.alerts ? <BellOff className="h-4 w-4" aria-label="Turn alerts off" /> : <Bell className="h-4 w-4" aria-label="Turn alerts on" />}
                </SubmitButton>
              </form>
              <form action={deleteSavedSearch.bind(null, s.id)}>
                <SubmitButton className={`${iconBtn} hover:text-red-600`}>
                  <Trash2 className="h-4 w-4" aria-label="Delete" />
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={Search}
          title="No saved searches yet"
          description="Search for something, like a Hilux in Fiji, then tap “Save search”. We'll email you when new ones are listed."
          action={<Link href="/search" className="btn-primary">Start searching</Link>}
        />
      )}
    </div>
  );
}
