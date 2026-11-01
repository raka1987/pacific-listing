import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { STAFF_ROLES, requireStaff } from "@/lib/auth";
import { timeAgo } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Member chats" };

type Row = { id: string; member_id: string; member_name: string; last_message: string | null; last_message_at: string; last_from_member: boolean; unread: boolean };

export default async function AdminMemberChats() {
  await requireStaff(STAFF_ROLES);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_support_chats");
  const chats = (data ?? []) as Row[];

  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 text-2xl font-semibold text-ink">Member chats</h1>
      <p className="mb-5 text-sm text-muted">
        Chats between your team and members. Members see them as <strong>Pacific Listing Support</strong>. To start one, open a
        member in <Link href="/admin/users" className="font-medium text-lagoon-700 hover:underline">Users &amp; staff</Link> and click
        Message this member.
      </p>
      {error ? (
        <div className="card p-6 text-sm text-ink-2">Run the database update 20261113000000_support_chats.sql to switch this on.</div>
      ) : chats.length ? (
        <ul className="card divide-y divide-line p-0">
          {chats.map((c) => (
            <li key={c.id}>
              <Link href={`/admin/chats/${c.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-subtle">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${c.unread ? "bg-coral-500" : "bg-transparent"}`} aria-label={c.unread ? "Unread" : undefined} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={`truncate ${c.unread ? "font-bold" : "font-semibold"} text-ink`}>{c.member_name}</p>
                    <span className="shrink-0 text-xs text-faint">{timeAgo(c.last_message_at)}</span>
                  </div>
                  <p className={`truncate text-sm ${c.unread ? "font-medium text-ink" : "text-muted"}`}>
                    {c.last_message ? `${c.last_from_member ? "" : "Team: "}${c.last_message}` : "No messages yet"}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="card flex flex-col items-center p-10 text-center text-sm text-muted">
          <MessagesSquare className="mb-2 h-8 w-8 text-faint" /> No member chats yet.
        </div>
      )}
    </div>
  );
}
