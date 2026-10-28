import { SubmitButton } from "@/components/submit-button";
import { createClient } from "@/lib/supabase/server";
import { adminUpdateSettings } from "../actions";

export const metadata = { title: "Settings" };

export default async function AdminSettings() {
  const supabase = await createClient();
  const { data: s } = await supabase.from("site_settings").select("*").eq("id", 1).single();

  return (
    <div className="max-w-2xl">
      <h1 className="mb-5 text-2xl font-extrabold text-ink">Site settings</h1>
      <form action={adminUpdateSettings} className="card divide-y divide-line">
        <label className="flex cursor-pointer items-start justify-between gap-6 p-5">
          <span>
            <span className="block font-semibold text-ink">Review new ads before they go live</span>
            <span className="mt-0.5 block text-sm text-muted">
              When on, new ads wait in <strong>Listings → Needs review</strong> until you approve them. When off, ads go live instantly
              and you moderate using reports.
            </span>
          </span>
          <input type="checkbox" name="require_approval" defaultChecked={s?.require_approval} className="mt-1 h-5 w-5 shrink-0 accent-lagoon-600" />
        </label>
        <div className="p-5">
          <label className="block font-semibold text-ink" htmlFor="announcement">Announcement banner</label>
          <p className="mt-0.5 mb-3 text-sm text-muted">Shown in a strip at the top of every page. Leave empty to hide it.</p>
          <input id="announcement" name="announcement" defaultValue={s?.announcement ?? ""} className="input" placeholder="e.g. 🎉 Pacific Listing is now live in Samoa!" />
        </div>
        <div className="flex justify-end p-5">
          <SubmitButton pendingText="Saving…">Save settings</SubmitButton>
        </div>
      </form>
    </div>
  );
}
