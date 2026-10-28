import Link from "next/link";
import { BadgeCheck, Ban, Search, Shield, ShieldOff, Undo2 } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { countryByCode } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { adminUpdateUser } from "../actions";
import { ActionButton, ConfirmButton } from "../ui";

export const metadata = { title: "Users" };

type AdminUser = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  country: string | null;
  role: "user" | "admin";
  is_banned: boolean;
  is_verified: boolean;
  created_at: string;
  listing_count: number;
};

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const supabase = await createClient();
  const current = await getCurrentUser();
  const { data, error } = await supabase.rpc("admin_users", { search: q || null });
  const users = (data ?? []) as AdminUser[];
  const btn = "inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink-2 hover:bg-subtle";

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">Users</h1>
          <p className="text-sm text-muted">{users.length} shown{users.length === 200 ? " (first 200 — search to narrow down)" : ""}</p>
        </div>
        <form className="relative">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-faint" />
          <input name="q" defaultValue={q} placeholder="Name, email or phone…" className="input w-64 pl-9" />
        </form>
      </div>
      {error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error.message}</p>}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-line bg-subtle text-left text-xs font-semibold tracking-wide text-muted uppercase">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Country</th>
              <th className="px-4 py-3">Ads</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.map((u) => {
              const self = u.id === current?.user.id;
              return (
                <tr key={u.id} className={u.is_banned ? "bg-red-50/50" : ""}>
                  <td className="px-4 py-3">
                    <Link href={`/seller/${u.id}`} target="_blank" className="font-medium text-ink hover:text-lagoon-700">
                      {u.full_name || "—"}
                    </Link>
                    <div className="flex items-center gap-1.5 text-xs text-muted">
                      {u.email}
                      {u.role === "admin" && <span className="badge bg-ink text-canvas">Admin</span>}
                      {u.is_verified && <BadgeCheck className="h-3.5 w-3.5 text-lagoon-600" />}
                      {u.is_banned && <span className="badge bg-red-100 text-red-700">Banned</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-2">{u.phone || "—"}</td>
                  <td className="px-4 py-3 text-ink-2">{countryByCode(u.country)?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className="text-ink-2">{u.listing_count}</span>
                  </td>
                  <td className="px-4 py-3 text-ink-2">{formatDate(u.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <form action={adminUpdateUser.bind(null, u.id, { is_verified: !u.is_verified })}>
                        <ActionButton className={btn}>
                          <BadgeCheck className="h-3.5 w-3.5" /> {u.is_verified ? "Unverify" : "Verify"}
                        </ActionButton>
                      </form>
                      {!self && (
                        <form action={adminUpdateUser.bind(null, u.id, { role: u.role === "admin" ? "user" : "admin" })}>
                          <ConfirmButton
                            message={u.role === "admin" ? `Remove admin access from ${u.full_name}?` : `Give ${u.full_name} full admin access?`}
                            className={btn}
                          >
                            {u.role === "admin" ? <ShieldOff className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
                            {u.role === "admin" ? "Remove admin" : "Make admin"}
                          </ConfirmButton>
                        </form>
                      )}
                      {!self && (
                        <form action={adminUpdateUser.bind(null, u.id, { is_banned: !u.is_banned })}>
                          {u.is_banned ? (
                            <ActionButton className={btn}><Undo2 className="h-3.5 w-3.5" /> Unban</ActionButton>
                          ) : (
                            <ConfirmButton message={`Ban ${u.full_name}? Their live ads will be hidden.`} className={`${btn} text-red-600 hover:bg-red-50`}>
                              <Ban className="h-3.5 w-3.5" /> Ban
                            </ConfirmButton>
                          )}
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!users.length && <p className="p-8 text-center text-sm text-muted">No users found.</p>}
      </div>
    </div>
  );
}
