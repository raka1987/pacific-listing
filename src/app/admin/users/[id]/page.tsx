import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Ban, BadgeCheck, ExternalLink, Mail, Phone, Store, Undo2 } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { OrderStatusBadge } from "@/components/order-status";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { requireStaff } from "@/lib/auth";
import { countryByCode, ORDER_KINDS, ROLE_DESCRIPTIONS, ROLES } from "@/lib/constants";
import { formatDate, formatMoney, formatPrice, isBusiness, timeAgo } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { LISTING_COLUMNS, type Listing, type Order, type Plan, type Role } from "@/lib/types";
import {
  adminStartSupportChat,
  adminAddUserNote,
  adminBanUser,
  adminEndBusiness,
  adminGiveBusiness,
  adminSetRole,
  adminUpdateUser,
  adminUpdateUserLimits,
} from "../../actions";
import { ActionButton, ConfirmButton } from "../../ui";
import { PushTest } from "./push-test";

export const metadata = { title: "User" };

type Detail = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  whatsapp: string | null;
  country: string | null;
  city: string | null;
  avatar_url: string | null;
  role: Role;
  is_banned: boolean;
  ban_reason: string | null;
  is_verified: boolean;
  ad_limit: number | null;
  business_name: string | null;
  business_until: string | null;
  plan_name: string | null;
  created_at: string;
  live_ads: number;
  reports_against: number;
};

export default async function AdminUserPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ chat?: string }> }) {
  const { chat: chatError } = await searchParams;
  const { profile: me } = await requireStaff(["admin"]);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const [{ data: d }, { data: l }, { data: o }, { data: n }, { data: pl }, { data: settings }] = await Promise.all([
    supabase.rpc("admin_user_detail", { p_id: id }),
    supabase.from("listings").select(LISTING_COLUMNS).eq("user_id", id).order("created_at", { ascending: false }).limit(50),
    supabase.from("orders").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(50),
    supabase.from("user_notes").select("id, body, created_at, author:profiles!user_notes_author_id_fkey(full_name)").eq("user_id", id).order("created_at", { ascending: false }),
    supabase.from("plans").select("*").order("sort"),
    supabase.from("site_settings").select("free_ad_limit").eq("id", 1).single(),
  ]);
  const u = d as Detail | null;
  if (!u) notFound();
  const { data: phoneRows, error: phoneErr } = await supabase.rpc("admin_push_tokens", { p_user: id });
  const phones = phoneErr ? null : ((phoneRows ?? []) as { platform: string; updated_at: string }[]);
  const listings = (l ?? []) as Listing[];
  const orders = (o ?? []) as Order[];
  const notes = (n ?? []) as unknown as { id: string; body: string; created_at: string; author: { full_name: string } | null }[];
  const plans = (pl ?? []) as Plan[];
  const business = isBusiness(u.business_until);
  const self = u.id === me.id;
  const spent = orders.filter((x) => x.status === "paid").reduce<Record<string, number>>((acc, x) => ((acc[x.currency] = (acc[x.currency] ?? 0) + Number(x.amount)), acc), {});

  return (
    <div className="max-w-6xl space-y-6">
      <Link href="/admin/users" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Users & staff
      </Link>

      <div className="card flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
        <Avatar name={u.full_name || u.email} url={u.avatar_url} size={72} />
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 font-display text-2xl font-semibold">
            {u.full_name || "No name"}
            {u.is_verified && <BadgeCheck className="h-5 w-5 text-lagoon-600" aria-label="Verified" />}
            {u.role !== "user" && <span className="badge bg-ink text-canvas">{ROLES[u.role]}</span>}
            {business && (
              <span className="badge bg-lagoon-100 text-lagoon-700">
                <Store className="h-3 w-3" /> {u.business_name}
              </span>
            )}
            {u.is_banned && <span className="badge bg-red-100 text-red-700">Banned</span>}
          </h1>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
            <span className="flex items-center gap-1 select-all"><Mail className="h-4 w-4" /> {u.email}</span>
            {u.phone && <span className="flex items-center gap-1 select-all"><Phone className="h-4 w-4" /> {u.phone}</span>}
            <span>{[u.city, countryByCode(u.country)?.name].filter(Boolean).join(", ") || "No location"}</span>
            <span>Joined {formatDate(u.created_at)}</span>
          </div>
        </div>
        <Link href={`/seller/${u.id}`} target="_blank" className="btn-secondary shrink-0">
          Public page <ExternalLink className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Live ads" value={String(u.live_ads)} />
        <Stat label="All ads" value={String(listings.length)} />
        <Stat label="Reports against" value={String(u.reports_against)} warn={u.reports_against > 0} />
        <Stat label="Total spent" value={Object.entries(spent).map(([c, v]) => formatMoney(v, c)).join(" · ") || "—"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="card overflow-hidden">
            <h2 className="border-b border-line px-5 py-4 font-bold">Ads</h2>
            {listings.length ? (
              <ul className="divide-y divide-line">
                {listings.map((x) => (
                  <li key={x.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <Link href={`/listing/${x.id}`} target="_blank" className="min-w-0 flex-1 truncate font-medium text-ink hover:text-lagoon-700">{x.title}</Link>
                    <span className="hidden text-ink-2 sm:inline">{formatPrice(x.price, x.price_type, x.country)}</span>
                    <StatusBadge status={x.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-5 text-sm text-muted">No ads.</p>
            )}
          </section>

          <section className="card overflow-hidden">
            <h2 className="border-b border-line px-5 py-4 font-bold">Payments</h2>
            {orders.length ? (
              <ul className="divide-y divide-line">
                {orders.map((x) => (
                  <li key={x.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                    <span className="w-20 font-medium text-ink">{x.order_number}</span>
                    <span className="min-w-0 flex-1 truncate text-ink-2">{ORDER_KINDS[x.kind]} · {x.description}</span>
                    <span className="font-semibold text-ink tabular-nums">{x.amount === 0 ? "Free" : formatMoney(x.amount, x.currency)}</span>
                    <OrderStatusBadge status={x.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-5 text-sm text-muted">No payments.</p>
            )}
          </section>

          <section className="card p-5">
            <h2 className="font-bold">Staff notes</h2>
            <p className="text-sm text-muted">Only staff can see these.</p>
            <form action={adminAddUserNote.bind(null, u.id)} className="mt-3 flex gap-2">
              <input name="body" required maxLength={2000} placeholder="e.g. Called about a duplicate ad, agreed to remove it" className="input" />
              <SubmitButton className="btn-secondary shrink-0" pendingText="Adding…">Add</SubmitButton>
            </form>
            <ul className="mt-4 space-y-3">
              {notes.map((x) => (
                <li key={x.id} className="rounded-2xl bg-subtle p-3 text-sm">
                  <p className="text-ink">{x.body}</p>
                  <p className="mt-1 text-xs text-muted">{x.author?.full_name ?? "Staff"} · {timeAgo(x.created_at)}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="space-y-6">
          {!self && (
            <form action={adminStartSupportChat.bind(null, u.id)} className="card p-5">
              <h2 className="font-bold">Message this member</h2>
              <p className="mt-1 text-sm text-muted">Opens a chat in their Messages from Pacific Listing Support. They get a notification and can reply.</p>
              {chatError && <p className="mt-2 text-sm text-red-600">{chatError}</p>}
              <SubmitButton className="btn-primary mt-3 w-full" pendingText="Opening…">Message this member</SubmitButton>
            </form>
          )}
          <PushTest userId={u.id} phones={phones} />
          <section className="card space-y-3 p-5">
            <h2 className="font-bold">Role</h2>
            {self ? (
              <p className="text-sm text-muted">This is you. Another admin has to change your role.</p>
            ) : (
              <form action={adminSetRole.bind(null, u.id)} className="space-y-2">
                {(Object.keys(ROLES) as Role[]).map((r) => (
                  <label key={r} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line p-3 has-[:checked]:border-lagoon-500 has-[:checked]:bg-lagoon-50">
                    <input type="radio" name="role" value={r} defaultChecked={u.role === r} className="mt-1 accent-lagoon-600" />
                    <span>
                      <span className="block text-sm font-semibold text-ink">{ROLES[r]}</span>
                      <span className="text-xs text-muted">{ROLE_DESCRIPTIONS[r]}</span>
                    </span>
                  </label>
                ))}
                <SubmitButton className="btn-secondary w-full" pendingText="Saving…">Save role</SubmitButton>
              </form>
            )}
          </section>

          <section className="card space-y-3 p-5">
            <h2 className="font-bold">Business account</h2>
            {business ? (
              <>
                <p className="text-sm text-ink-2">
                  <strong>{u.business_name}</strong> on {u.plan_name ?? "a plan"} until {formatDate(u.business_until!)}.
                </p>
                <form action={adminEndBusiness.bind(null, u.id)}>
                  <ConfirmButton message="End this business account now?" className="btn-secondary w-full text-xs">End business account</ConfirmButton>
                </form>
              </>
            ) : (
              <p className="text-sm text-muted">Not a business account. You can give one for free, for example for a partner or a trial.</p>
            )}
            <form action={adminGiveBusiness.bind(null, u.id)} className="space-y-2 border-t border-line pt-3">
              <input name="business_name" defaultValue={u.business_name ?? ""} placeholder="Business name" className="input" />
              <div className="grid grid-cols-[1fr_90px] gap-2">
                <select name="plan_id" className="input">
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <input name="days" type="number" min={1} defaultValue={30} className="input" aria-label="Days" />
              </div>
              <SubmitButton className="btn-secondary w-full text-xs" pendingText="Saving…">{business ? "Add days" : "Give business account"}</SubmitButton>
            </form>
          </section>

          <section className="card space-y-3 p-5">
            <h2 className="font-bold">Limits</h2>
            <form action={adminUpdateUserLimits.bind(null, u.id)} className="space-y-2">
              <label className="label" htmlFor="ad_limit">Live ads allowed</label>
              <input id="ad_limit" name="ad_limit" type="number" min={0} defaultValue={u.ad_limit ?? ""} placeholder={`Default (${business ? "from plan" : (settings?.free_ad_limit ?? "unlimited")})`} className="input" />
              <SubmitButton className="btn-secondary w-full text-xs" pendingText="Saving…">Save limit</SubmitButton>
            </form>
            <form action={adminUpdateUser.bind(null, u.id, { is_verified: !u.is_verified })}>
              <ActionButton className="btn-secondary w-full text-xs">
                <BadgeCheck className="h-4 w-4" /> {u.is_verified ? "Remove verified tick" : "Give verified tick"}
              </ActionButton>
            </form>
          </section>

          {!self && (
            <section className="card space-y-3 border-red-200 p-5">
              <h2 className="font-bold text-red-700">Ban</h2>
              {u.is_banned ? (
                <>
                  <p className="text-sm text-ink-2">Banned{u.ban_reason ? `: ${u.ban_reason}` : "."}</p>
                  <form action={adminUpdateUser.bind(null, u.id, { is_banned: false })}>
                    <ActionButton className="btn-secondary w-full text-xs">
                      <Undo2 className="h-4 w-4" /> Unban
                    </ActionButton>
                  </form>
                </>
              ) : (
                <form action={adminBanUser.bind(null, u.id)} className="space-y-2">
                  <input name="reason" placeholder="Reason (kept private)" className="input" />
                  <ConfirmButton message={`Ban ${u.full_name}? All their ads will be hidden.`} className="btn-danger w-full text-xs">
                    <Ban className="h-4 w-4" /> Ban user
                  </ConfirmButton>
                </form>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-1 font-display text-xl font-semibold tabular-nums ${warn ? "text-red-600" : "text-ink"}`}>{value}</p>
    </div>
  );
}
