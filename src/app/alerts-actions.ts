"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff, MOD_ROLES } from "@/lib/auth";
import { COUNTRIES, CATEGORIES } from "@/lib/constants";
import type { SearchFilters } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

type Result = { error?: string; ok?: boolean };

async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

// ---------------------------------------------------------------------------
// Email settings
// ---------------------------------------------------------------------------
export async function setNotifyPrefs(chat: boolean, alerts: boolean): Promise<Result> {
  const { supabase, user } = await currentUser();
  if (!user) return { error: "Please log in." };
  const { error } = await supabase.rpc("set_my_notify_prefs", { p_chat: chat, p_alerts: alerts });
  return error ? { error: "Couldn't save. Please try again." } : { ok: true };
}

// ---------------------------------------------------------------------------
// Saved searches
// ---------------------------------------------------------------------------
const num = (v?: string) => (v && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : null);

/** The saved-search columns for a set of search filters (unknown values dropped). */
export async function searchRow(f: SearchFilters) {
  const category = CATEGORIES.find((c) => c.slug === f.category);
  return {
    q: f.q?.trim().slice(0, 80) || null,
    category: category?.slug ?? null,
    sub: category?.subcategories.some((s) => s.slug === f.sub) ? f.sub! : null,
    country: COUNTRIES.some((c) => c.code === f.country) ? f.country! : null,
    city: f.city?.trim().slice(0, 60) || null,
    min_price: num(f.min),
    max_price: num(f.max),
    condition: f.condition === "new" || f.condition === "used" ? f.condition : null,
  };
}

export async function saveSearch(filters: SearchFilters, back: string): Promise<Result> {
  const { supabase, user } = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(back)}`);
  const row = await searchRow(filters);
  const { error } = await supabase.from("saved_searches").upsert({ user_id: user.id, ...row, alerts: true }, {
    onConflict: "user_id,q,category,sub,country,city,min_price,max_price,condition",
  });
  if (error) return { error: error.message.includes("up to 20") ? error.message : "Couldn't save this search. Please try again." };
  revalidatePath("/saved-searches");
  return { ok: true };
}

export async function setSearchAlerts(id: string, alerts: boolean) {
  const { supabase } = await currentUser();
  await supabase.from("saved_searches").update({ alerts }).eq("id", id);
  revalidatePath("/saved-searches");
}

export async function deleteSavedSearch(id: string) {
  const { supabase } = await currentUser();
  await supabase.from("saved_searches").delete().eq("id", id);
  revalidatePath("/saved-searches");
}

// ---------------------------------------------------------------------------
// Ratings
// ---------------------------------------------------------------------------
export async function submitReview(conversationId: string, rating: number, comment: string): Promise<Result> {
  const { supabase, user } = await currentUser();
  if (!user) return { error: "Please log in." };
  const { error } = await supabase.rpc("submit_review", { p_conversation: conversationId, p_rating: rating, p_comment: comment });
  if (error) return { error: error.message };
  revalidatePath("/seller/[id]", "page");
  return { ok: true };
}

export async function deleteReview(id: string, sellerId: string) {
  const { supabase } = await currentUser();
  await supabase.from("reviews").delete().eq("id", id);
  revalidatePath(`/seller/${sellerId}`);
}

// ---------------------------------------------------------------------------
// Verified sellers
// ---------------------------------------------------------------------------
export type VerifyState = { error?: string; values?: Record<string, string> };

export async function requestVerification(_: VerifyState, fd: FormData): Promise<VerifyState> {
  const { supabase, user } = await currentUser();
  if (!user) redirect("/login?next=/verify");
  const phone = String(fd.get("phone") ?? "").trim();
  const business = String(fd.get("business_name") ?? "").trim();
  const values = { phone, business_name: business };
  const file = fd.get("document");
  if (phone.replace(/\D/g, "").length < 6) return { error: "Enter the phone number buyers can reach you on.", values };
  if (!(file instanceof File) || file.size === 0) return { error: "Add a photo of your ID (passport, driver's licence or voter card).", values };
  if (file.size > 8 * 1024 * 1024) return { error: "That photo is too big. Please use one under 8 MB.", values };
  if (!/^(image\/|application\/pdf)/.test(file.type)) return { error: "Please upload a photo or a PDF.", values };

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "jpg";
  const path = `${user.id}/${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage.from("verification").upload(path, file, { contentType: file.type });
  if (upErr) return { error: "Couldn't upload the photo. Please try again.", values };
  const { error } = await supabase
    .from("verification_requests")
    .insert({ user_id: user.id, phone, business_name: business || null, document_path: path });
  if (error) {
    await supabase.storage.from("verification").remove([path]);
    return { error: error.code === "23505" ? "You already have a request waiting for review." : "Couldn't send your request. Please try again.", values };
  }
  revalidatePath("/verify");
  redirect("/verify?sent=1");
}

export async function reviewVerification(id: string, approve: boolean, fd?: FormData) {
  await requireStaff(MOD_ROLES);
  const supabase = await createClient();
  const { data: req } = await supabase.from("verification_requests").select("document_path").eq("id", id).maybeSingle();
  const reason = String(fd?.get("reason") ?? "").trim();
  const { error } = await supabase.rpc("review_verification", { p_id: id, p_approve: approve, p_reason: reason || null });
  // The ID photo is only needed for the check, so it's deleted straight after.
  if (!error && req?.document_path) await supabase.storage.from("verification").remove([req.document_path]);
  revalidatePath("/admin/verification");
}
