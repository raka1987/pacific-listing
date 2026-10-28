import { Eye, EyeOff, Trash2 } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Notice } from "@/lib/types";
import { adminCreateNotice, adminDeleteNotice, adminToggleNotice } from "../actions";
import { ActionButton, ConfirmButton } from "../ui";

export const metadata = { title: "Notice board" };

export default async function AdminNotices() {
  const supabase = await createClient();
  const { data } = await supabase.from("notices").select("*").order("created_at", { ascending: false });
  const notices = (data ?? []) as Notice[];
  const btn = "inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink-2 hover:bg-subtle";

  return (
    <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
      <div>
        <h1 className="mb-5 text-2xl font-extrabold text-ink">Notice board</h1>
        <form action={adminCreateNotice} className="card space-y-4 p-5">
          <h2 className="font-bold">New notice</h2>
          <div>
            <label className="label" htmlFor="title">Title</label>
            <input id="title" name="title" required className="input" placeholder="e.g. Community clean-up this Saturday" />
          </div>
          <div>
            <label className="label" htmlFor="body">Details</label>
            <textarea id="body" name="body" rows={5} className="input" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_published" defaultChecked className="h-4 w-4 accent-lagoon-600" /> Publish now
          </label>
          <SubmitButton pendingText="Posting…">Post notice</SubmitButton>
        </form>
      </div>
      <div className="space-y-3 xl:pt-14">
        {notices.map((n) => (
          <div key={n.id} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-ink">
                  {n.title} {!n.is_published && <span className="badge ml-1 bg-subtle text-muted">Draft</span>}
                </p>
                <p className="text-xs text-muted">{formatDate(n.created_at)}</p>
              </div>
              <div className="flex gap-1.5">
                <form action={adminToggleNotice.bind(null, n.id, !n.is_published)}>
                  <ActionButton className={btn}>
                    {n.is_published ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    {n.is_published ? "Unpublish" : "Publish"}
                  </ActionButton>
                </form>
                <form action={adminDeleteNotice.bind(null, n.id)}>
                  <ConfirmButton message="Delete this notice?" className={`${btn} text-red-600`}><Trash2 className="h-3.5 w-3.5" /></ConfirmButton>
                </form>
              </div>
            </div>
            {n.body && <p className="mt-2 whitespace-pre-line text-sm text-ink-2">{n.body}</p>}
          </div>
        ))}
        {!notices.length && <div className="card p-10 text-center text-sm text-muted">No notices yet.</div>}
      </div>
    </div>
  );
}
