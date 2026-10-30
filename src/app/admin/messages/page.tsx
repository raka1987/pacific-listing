import { requireStaff, STAFF_ROLES } from "@/lib/auth";
import Link from "next/link";
import { Archive, Check, Mail, Reply, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { adminDeleteMessage, adminSetMessageStatus } from "../actions";
import { ActionButton, ConfirmButton } from "../ui";

export const metadata = { title: "Messages" };

type Message = { id: string; name: string; email: string; subject: string; message: string; status: string; created_at: string };

export default async function AdminMessages({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireStaff(STAFF_ROLES);
  const { status = "inbox" } = await searchParams;
  const supabase = await createClient();
  let query = supabase.from("contact_messages").select("*").order("created_at", { ascending: false }).limit(100);
  query = status === "archived" ? query.eq("status", "archived") : query.in("status", ["new", "read"]);
  const { data } = await query;
  const messages = (data ?? []) as Message[];
  const btn = "inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink-2 hover:bg-subtle";

  return (
    <div>
      <h1 className="mb-5 text-2xl font-extrabold text-ink">Contact messages</h1>
      <div className="mb-4 flex gap-2">
        {[["inbox", "Inbox"], ["archived", "Archived"]].map(([s, l]) => (
          <Link
            key={s}
            href={`/admin/messages?status=${s}`}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${status === s ? "bg-ink text-canvas" : "bg-surface text-ink-2 ring-1 ring-line"}`}
          >
            {l}
          </Link>
        ))}
      </div>
      {messages.length ? (
        <ul className="space-y-3">
          {messages.map((m) => (
            <li key={m.id} className={`card p-5 ${m.status === "new" ? "border-l-4 border-l-coral-500" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink">
                    {m.subject} {m.status === "new" && <span className="badge ml-1 bg-coral-500 text-white">New</span>}
                  </p>
                  <p className="text-sm text-muted">
                    {m.name} · <a href={`mailto:${m.email}`} className="text-lagoon-700 hover:underline">{m.email}</a> · {formatDate(m.created_at)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <a href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject}`)}`} className={btn}>
                    <Reply className="h-3.5 w-3.5" /> Reply
                  </a>
                  {m.status === "new" && (
                    <form action={adminSetMessageStatus.bind(null, m.id, "read")}>
                      <ActionButton className={btn}><Check className="h-3.5 w-3.5" /> Mark read</ActionButton>
                    </form>
                  )}
                  {m.status !== "archived" && (
                    <form action={adminSetMessageStatus.bind(null, m.id, "archived")}>
                      <ActionButton className={btn}><Archive className="h-3.5 w-3.5" /> Archive</ActionButton>
                    </form>
                  )}
                  <form action={adminDeleteMessage.bind(null, m.id)}>
                    <ConfirmButton message="Delete this message?" className={`${btn} text-red-600`}><Trash2 className="h-3.5 w-3.5" /></ConfirmButton>
                  </form>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-line text-sm text-ink-2">{m.message}</p>
            </li>
          ))}
        </ul>
      ) : (
        <div className="card flex flex-col items-center p-10 text-center text-sm text-muted">
          <Mail className="mb-2 h-8 w-8 text-slate-300" /> No messages.
        </div>
      )}
    </div>
  );
}
