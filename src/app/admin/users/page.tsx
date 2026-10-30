import Link from "next/link";
import { BadgeCheck, ChevronRight, Search, Store } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { countryByCode, ROLES } from "@/lib/constants";
import { formatDate, isBusiness } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types";

export const metadata = { title: "Users & staff" };

type AdminUser = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  country: string | null;
  role: Role;
  is_banned: boolean;
  is_verified: boolean;
  created_at: string;
  listing_count: number;
  business_name: string | null;
  business_until: string | null;
};

const FILTERS = [
  ["all", "Everyone"],
  ["staff", "Staff"],
  ["business", "Business"],
  ["banned", "Banned"],
] as const;

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string }> }) {
  await requireStaff(["admin"]);
  const { q = "", filter = "all" } = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_users", { search: q || null });
  let users = (data ?? []) as AdminUser[];
  if (filter === "staff") users = users.filter((u) => u.role !== "user");
  if (filter === "business") users = users.filter((u) => isBusiness(u.business_until));
  if (filter === "banned") users = users.filter((u) => u.is_banned);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Users & staff</h1>
          <p className="text-sm text-muted">Open a user to change their role, ban them, set limits, give a business account or add notes.</p>
        </div>
        <form className="relative">
          <input type="hidden" name="filter" value={filter} />
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-faint" />
          <input name="q" defaultValue={q} placeholder="Name, email, phone or business…" className="input w-72 pl-9" />
        </form>
      </div>
      <div className="mb-4 flex gap-2">
        {FILTERS.map(([f, l]) => (
          <Link
            key={f}
            href={`/admin/users?filter=${f}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${filter === f ? "bg-ink text-canvas" : "bg-surface text-ink-2 ring-1 ring-line"}`}
          >
            {l}
          </Link>
        ))}
      </div>
      {error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error.message}</p>}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b border-line bg-subtle text-left text-xs font-semibold tracking-wide text-muted uppercase">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Country</th>
              <th className="px-4 py-3 text-right">Ads</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.map((u) => (
              <tr key={u.id} className={u.is_banned ? "bg-red-50" : ""}>
                <td className="px-4 py-3">
                  <Link href={`/admin/users/${u.id}`} className="font-semibold text-ink hover:text-lagoon-700">
                    {u.full_name || "—"}
                  </Link>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    {u.email}
                    {u.role !== "user" && <span className="badge bg-ink text-canvas">{ROLES[u.role]}</span>}
                    {u.is_verified && <BadgeCheck className="h-3.5 w-3.5 text-lagoon-600" aria-label="Verified" />}
                    {isBusiness(u.business_until) && (
                      <span className="badge bg-lagoon-100 text-lagoon-700">
                        <Store className="h-3 w-3" /> {u.business_name || "Business"}
                      </span>
                    )}
                    {u.is_banned && <span className="badge bg-red-100 text-red-700">Banned</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-ink-2">{u.phone || "—"}</td>
                <td className="px-4 py-3 text-ink-2">{countryByCode(u.country)?.name ?? "—"}</td>
                <td className="px-4 py-3 text-right text-ink-2 tabular-nums">{u.listing_count}</td>
                <td className="px-4 py-3 text-ink-2">{formatDate(u.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/users/${u.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-lagoon-700 hover:underline">
                    Manage <ChevronRight className="h-4 w-4" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!users.length && <p className="p-8 text-center text-sm text-muted">No users found.</p>}
      </div>
    </div>
  );
}
