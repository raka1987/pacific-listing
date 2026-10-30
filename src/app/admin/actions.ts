"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MOD_ROLES, requireStaff, SALES_ROLES, STAFF_ROLES } from "@/lib/auth";
import { CATEGORIES, COUNTRIES, CURRENCIES, IMAGE_BUCKET } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types";

/** Checks the role, and returns a client plus a logger for the activity log. */
async function staff(roles: Role[]) {
  const { user } = await requireStaff(roles);
  const supabase = await createClient();
  async function log(action: string, targetType?: string, targetId?: string, details?: Record<string, unknown>) {
    await supabase.from("audit_log").insert({ actor_id: user.id, action, target_type: targetType, target_id: targetId, details });
  }
  return { supabase, log, user };
}

function done(...paths: string[]) {
  for (const p of ["/admin", ...paths]) revalidatePath(p);
  revalidatePath("/", "layout");
}

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const num = (fd: FormData, key: string) => {
  const v = str(fd, key);
  return v === "" || isNaN(Number(v)) ? null : Number(v);
};

/** Reads price inputs named `<prefix><CURRENCY>` into {"FJD": 15, ...}. */
function readPrices(fd: FormData, prefix = "price_") {
  const prices: Record<string, number> = {};
  for (const c of CURRENCIES) {
    const v = num(fd, `${prefix}${c}`);
    if (v != null && v >= 0) prices[c] = v;
  }
  return prices;
}

// Listings ------------------------------------------------------------------
export async function adminSetListingStatus(id: string, status: string, fd?: FormData) {
  const { supabase, log } = await staff(MOD_ROLES);
  const rejection_reason = status === "rejected" ? String(fd?.get("reason") ?? "").trim() || null : null;
  await supabase.from("listings").update({ status, rejection_reason }).eq("id", id);
  await log(`listing.${status}`, "listing", id, rejection_reason ? { reason: rejection_reason } : undefined);
  done("/admin/listings", `/listing/${id}`);
}

export async function adminToggleFeatured(id: string, featured: boolean) {
  const { supabase, log } = await staff(MOD_ROLES);
  await supabase.from("listings").update({ is_featured: featured, featured_until: null }).eq("id", id);
  await log(featured ? "listing.feature" : "listing.unfeature", "listing", id);
  done("/admin/listings");
}

export async function adminDeleteListing(id: string) {
  const { supabase, log } = await staff(MOD_ROLES);
  const { data } = await supabase.from("listings").select("title, images").eq("id", id).single();
  await supabase.from("listings").delete().eq("id", id);
  const marker = `/storage/v1/object/public/${IMAGE_BUCKET}/`;
  const paths = (data?.images ?? []).map((u: string) => u.split(marker)[1]).filter(Boolean);
  if (paths.length) await supabase.storage.from(IMAGE_BUCKET).remove(paths);
  await log("listing.delete", "listing", id, { title: data?.title });
  done("/admin/listings", "/admin/reports");
}

// Users ---------------------------------------------------------------------
export async function adminUpdateUser(
  id: string,
  patch: { is_banned?: boolean; is_verified?: boolean; role?: Role; ban_reason?: string | null },
) {
  const { supabase, log, user } = await staff(["admin"]);
  if (id === user.id && (patch.is_banned || (patch.role && patch.role !== "admin"))) return; // don't lock yourself out
  if (patch.is_banned === false) patch.ban_reason = null;
  await supabase.from("profiles").update(patch).eq("id", id);
  const action = patch.role ? "user.role" : patch.is_banned !== undefined ? (patch.is_banned ? "user.ban" : "user.unban") : "user.verify";
  await log(action, "user", id, patch);
  done("/admin/users", `/admin/users/${id}`);
}

export async function adminBanUser(id: string, fd: FormData) {
  await adminUpdateUser(id, { is_banned: true, ban_reason: str(fd, "reason") || null });
}

export async function adminSetRole(id: string, fd: FormData) {
  const role = str(fd, "role") as Role;
  if (!["user", "admin", "moderator", "sales"].includes(role)) return;
  await adminUpdateUser(id, { role });
}

export async function adminUpdateUserLimits(id: string, fd: FormData) {
  const { supabase, log } = await staff(["admin"]);
  const ad_limit = num(fd, "ad_limit");
  await supabase.from("profiles").update({ ad_limit: ad_limit == null ? null : Math.floor(ad_limit) }).eq("id", id);
  await log("user.limit", "user", id, { ad_limit });
  done(`/admin/users/${id}`);
}

export async function adminGiveBusiness(id: string, fd: FormData) {
  const { supabase, log } = await staff(SALES_ROLES);
  const planId = str(fd, "plan_id");
  const days = Math.max(1, Math.floor(num(fd, "days") ?? 30));
  const name = str(fd, "business_name");
  const { data: p } = await supabase.from("profiles").select("business_until").eq("id", id).single();
  const from = p?.business_until && new Date(p.business_until) > new Date() ? new Date(p.business_until) : new Date();
  const until = new Date(from.getTime() + days * 86400000).toISOString();
  await supabase.from("profiles").update({ plan_id: planId || null, business_until: until, business_name: name || null }).eq("id", id);
  await log("user.business", "user", id, { plan_id: planId, days, business_name: name });
  done(`/admin/users/${id}`, "/admin/business");
}

export async function adminEndBusiness(id: string) {
  const { supabase, log } = await staff(SALES_ROLES);
  await supabase.from("profiles").update({ business_until: null }).eq("id", id);
  await log("user.business_end", "user", id);
  done(`/admin/users/${id}`, "/admin/business");
}

export async function adminAddUserNote(id: string, fd: FormData) {
  const { supabase, user } = await staff(STAFF_ROLES);
  const body = str(fd, "body");
  if (!body) return;
  await supabase.from("user_notes").insert({ user_id: id, author_id: user.id, body: body.slice(0, 2000) });
  done(`/admin/users/${id}`);
}

// Reports -------------------------------------------------------------------
export async function adminSetReportStatus(id: string, status: "open" | "resolved" | "dismissed") {
  const { supabase, log } = await staff(MOD_ROLES);
  await supabase.from("reports").update({ status }).eq("id", id);
  await log(`report.${status}`, "report", id);
  done("/admin/reports");
}

export async function adminHideReportedListing(listingId: string) {
  const { supabase, log } = await staff(MOD_ROLES);
  await supabase.from("listings").update({ status: "hidden" }).eq("id", listingId);
  await supabase.from("reports").update({ status: "resolved" }).eq("listing_id", listingId).eq("status", "open");
  await log("listing.hidden", "listing", listingId, { via: "report" });
  done("/admin/reports", "/admin/listings");
}

// Messages ------------------------------------------------------------------
export async function adminSetMessageStatus(id: string, status: "new" | "read" | "archived") {
  const { supabase } = await staff(STAFF_ROLES);
  await supabase.from("contact_messages").update({ status }).eq("id", id);
  done("/admin/messages");
}

export async function adminDeleteMessage(id: string) {
  const { supabase, log } = await staff(STAFF_ROLES);
  await supabase.from("contact_messages").delete().eq("id", id);
  await log("message.delete", "message", id);
  done("/admin/messages");
}

// Notices -------------------------------------------------------------------
export async function adminCreateNotice(fd: FormData) {
  const { supabase, log } = await staff(MOD_ROLES);
  const title = str(fd, "title");
  const body = str(fd, "body");
  if (!title) return;
  await supabase.from("notices").insert({ title, body, is_published: fd.get("is_published") === "on" });
  await log("notice.create", "notice", undefined, { title });
  done("/admin/notices", "/notices");
}

export async function adminToggleNotice(id: string, published: boolean) {
  const { supabase } = await staff(MOD_ROLES);
  await supabase.from("notices").update({ is_published: published }).eq("id", id);
  done("/admin/notices", "/notices");
}

export async function adminDeleteNotice(id: string) {
  const { supabase, log } = await staff(MOD_ROLES);
  await supabase.from("notices").delete().eq("id", id);
  await log("notice.delete", "notice", id);
  done("/admin/notices", "/notices");
}

// Settings ------------------------------------------------------------------
export async function adminUpdateSettings(fd: FormData) {
  const { supabase, log } = await staff(["admin"]);
  const limit = num(fd, "free_ad_limit");
  const offer = num(fd, "launch_offer_days");
  const launch = offer == null ? null : Math.min(60, Math.max(1, Math.floor(offer)));
  const values: Record<string, unknown> = {
      launch_offer_days: launch,
      require_approval: fd.get("require_approval") === "on",
      announcement: str(fd, "announcement") || null,
      free_ad_limit: limit == null ? null : Math.floor(limit),
      card_payments_enabled: fd.get("card_payments_enabled") === "on",
      payment_details: {
        mpaisa_number: str(fd, "mpaisa_number"),
        mycash_number: str(fd, "mycash_number"),
        bank_name: str(fd, "bank_name"),
        bank_account_name: str(fd, "bank_account_name"),
        bank_account_number: str(fd, "bank_account_number"),
        bank_branch: str(fd, "bank_branch"),
        instructions: str(fd, "instructions"),
      },
      updated_at: new Date().toISOString(),
  };
  let { error } = await supabase.from("site_settings").update(values).eq("id", 1);
  // Before the launch-offer database update has been run, save everything else.
  if (error && /launch_offer_days/.test(error.message)) {
    delete values.launch_offer_days;
    ({ error } = await supabase.from("site_settings").update(values).eq("id", 1));
  }
  if (error) console.error("settings", error.message);
  await log("settings.update", "settings");
  done("/admin/settings");
}

// Payments ------------------------------------------------------------------
export async function adminMarkPaid(id: string, fd: FormData) {
  const { supabase, log } = await staff(SALES_ROLES);
  const { error } = await supabase.rpc("admin_mark_order_paid", { p_order: id, p_note: str(fd, "note") || null });
  if (!error) await log("order.paid", "order", id);
  done("/admin/payments", "/admin/ads", "/admin/business", "/my-ads", "/orders");
}

export async function adminSetOrderStatus(id: string, status: "cancelled" | "refunded") {
  const { supabase, log } = await staff(SALES_ROLES);
  await supabase.from("orders").update({ status }).eq("id", id);
  await log(`order.${status}`, "order", id);
  done("/admin/payments");
}

// Promotions and posting fees -------------------------------------------------
export async function adminSavePackage(id: string, fd: FormData) {
  const { supabase, log } = await staff(SALES_ROLES);
  await supabase
    .from("boost_packages")
    .update({
      name: str(fd, "name"),
      description: str(fd, "description"),
      duration_days: num(fd, "duration_days"),
      is_active: fd.get("is_active") === "on",
      prices: readPrices(fd),
    })
    .eq("id", id);
  await log("pricing.package", "package", id, { name: str(fd, "name") });
  done("/admin/promotions", "/promote");
}

export async function adminSaveFee(category: string, fd: FormData) {
  const { supabase, log } = await staff(SALES_ROLES);
  await supabase
    .from("category_fees")
    .upsert({ category, is_active: fd.get("is_active") === "on", prices: readPrices(fd) });
  await log("pricing.fee", "category", category, { active: fd.get("is_active") === "on" });
  done("/admin/promotions", "/post");
}

// Business plans --------------------------------------------------------------
export async function adminSavePlan(id: string, fd: FormData) {
  const { supabase, log } = await staff(SALES_ROLES);
  await supabase
    .from("plans")
    .update({
      name: str(fd, "name"),
      description: str(fd, "description"),
      features: str(fd, "features").split("\n").map((f) => f.trim()).filter(Boolean),
      duration_days: Math.max(1, Math.floor(num(fd, "duration_days") ?? 30)),
      max_active_ads: num(fd, "max_active_ads"),
      free_bumps: Math.max(0, Math.floor(num(fd, "free_bumps") ?? 0)),
      waive_posting_fees: fd.get("waive_posting_fees") === "on",
      is_active: fd.get("is_active") === "on",
      prices: readPrices(fd),
    })
    .eq("id", id);
  await log("pricing.plan", "plan", id, { name: str(fd, "name") });
  done("/admin/business", "/business");
}

// Banner advertising ----------------------------------------------------------
export async function adminSaveSlot(code: string, fd: FormData) {
  const { supabase, log } = await staff(SALES_ROLES);
  await supabase
    .from("ad_slots")
    .update({ is_active: fd.get("is_active") === "on", prices: readPrices(fd), global_prices: readPrices(fd, "global_") })
    .eq("code", code);
  await log("pricing.ad_slot", "ad_slot", code);
  done("/admin/ads", "/advertise");
}

export type CampaignState = { error?: string };

export async function adminSaveCampaign(id: string | null, _: CampaignState, fd: FormData): Promise<CampaignState> {
  const { supabase, log, user } = await staff(SALES_ROLES);
  const countries =
    str(fd, "reach") === "global" ? [] : fd.getAll("countries").map(String).filter((c) => COUNTRIES.some((x) => x.code === c));
  if (str(fd, "reach") === "countries" && !countries.length) return { error: "Tick at least one country, or choose All countries." };
  const categories = fd.getAll("categories").map(String).filter((c) => CATEGORIES.some((x) => x.slug === c));
  const link = str(fd, "link_url");
  if (link && !/^https?:\/\//.test(link)) return { error: "The website link must start with http:// or https://" };
  const values = {
    advertiser_name: str(fd, "advertiser_name"),
    advertiser_email: str(fd, "advertiser_email") || null,
    advertiser_phone: str(fd, "advertiser_phone") || null,
    title: str(fd, "title"),
    image_url: str(fd, "image_url") || null,
    link_url: link || null,
    slot_code: str(fd, "slot_code"),
    countries,
    categories,
    starts_on: str(fd, "starts_on"),
    ends_on: str(fd, "ends_on"),
    amount: num(fd, "amount"),
    currency: CURRENCIES.includes(str(fd, "currency") as (typeof CURRENCIES)[number]) ? str(fd, "currency") : "FJD",
    notes: str(fd, "notes") || null,
  };
  if (!values.advertiser_name || !values.title) return { error: "Enter the advertiser and a campaign title." };
  if (!values.starts_on || !values.ends_on || values.ends_on < values.starts_on) return { error: "Check the start and end dates." };

  let campaignId = id;
  if (id) {
    const { error } = await supabase.from("ad_campaigns").update(values).eq("id", id);
    if (error) return { error: error.message };
    await log("campaign.update", "campaign", id, { title: values.title });
  } else {
    const { data, error } = await supabase
      .from("ad_campaigns")
      .insert({ ...values, created_by: user.id, status: "draft" })
      .select("id")
      .single();
    if (error) return { error: error.message };
    campaignId = data.id;
    await log("campaign.create", "campaign", data.id, { title: values.title });
  }
  done("/admin/ads");
  redirect(`/admin/ads/${campaignId}?saved=1`);
}

export async function adminSetCampaignStatus(id: string, status: "active" | "paused" | "ended" | "draft") {
  const { supabase, log } = await staff(SALES_ROLES);
  await supabase.from("ad_campaigns").update({ status }).eq("id", id);
  await log(`campaign.${status}`, "campaign", id);
  done("/admin/ads", `/admin/ads/${id}`);
}

/** Creates an invoice (an order) for a campaign, so it shows in Payments. */
export async function adminInvoiceCampaign(id: string, fd: FormData) {
  const { supabase, log } = await staff(SALES_ROLES);
  const { data: c } = await supabase.from("ad_campaigns").select("*").eq("id", id).single();
  if (!c || c.amount == null) return;
  const method = str(fd, "method") || "invoice";
  const { data: order } = await supabase
    .from("orders")
    .insert({
      kind: "campaign",
      description: `Banner advertising: ${c.title}`,
      campaign_id: id,
      amount: c.amount,
      currency: c.currency,
      method,
      billing_name: c.advertiser_name,
      billing_email: c.advertiser_email,
    })
    .select("id")
    .single();
  await supabase.from("ad_campaigns").update({ status: "awaiting_payment" }).eq("id", id).eq("status", "draft");
  await log("campaign.invoice", "campaign", id, { order: order?.id });
  done("/admin/ads", `/admin/ads/${id}`, "/admin/payments");
}

export async function adminDeleteCampaign(id: string) {
  const { supabase, log } = await staff(SALES_ROLES);
  await supabase.from("ad_campaigns").delete().eq("id", id);
  await log("campaign.delete", "campaign", id);
  done("/admin/ads");
  redirect("/admin/ads");
}
