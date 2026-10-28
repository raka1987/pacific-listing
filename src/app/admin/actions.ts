"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { IMAGE_BUCKET } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

async function admin() {
  await requireAdmin();
  return createClient();
}

function done(...paths: string[]) {
  for (const p of ["/admin", ...paths]) revalidatePath(p);
  revalidatePath("/", "layout");
}

// Listings ------------------------------------------------------------------
export async function adminSetListingStatus(id: string, status: string, fd?: FormData) {
  const supabase = await admin();
  const rejection_reason = status === "rejected" ? String(fd?.get("reason") ?? "").trim() || null : null;
  await supabase.from("listings").update({ status, rejection_reason }).eq("id", id);
  done("/admin/listings", `/listing/${id}`);
}

export async function adminToggleFeatured(id: string, featured: boolean) {
  const supabase = await admin();
  await supabase.from("listings").update({ is_featured: featured }).eq("id", id);
  done("/admin/listings");
}

export async function adminDeleteListing(id: string) {
  const supabase = await admin();
  const { data } = await supabase.from("listings").select("images").eq("id", id).single();
  await supabase.from("listings").delete().eq("id", id);
  const marker = `/storage/v1/object/public/${IMAGE_BUCKET}/`;
  const paths = (data?.images ?? []).map((u: string) => u.split(marker)[1]).filter(Boolean);
  if (paths.length) await supabase.storage.from(IMAGE_BUCKET).remove(paths);
  done("/admin/listings", "/admin/reports");
}

// Users ---------------------------------------------------------------------
export async function adminUpdateUser(id: string, patch: { is_banned?: boolean; is_verified?: boolean; role?: "user" | "admin" }) {
  const { user } = await requireAdmin();
  if (id === user.id && (patch.is_banned || patch.role === "user")) return; // don't lock yourself out
  const supabase = await createClient();
  await supabase.from("profiles").update(patch).eq("id", id);
  done("/admin/users");
}

// Reports -------------------------------------------------------------------
export async function adminSetReportStatus(id: string, status: "open" | "resolved" | "dismissed") {
  const supabase = await admin();
  await supabase.from("reports").update({ status }).eq("id", id);
  done("/admin/reports");
}

export async function adminHideReportedListing(listingId: string) {
  const supabase = await admin();
  await supabase.from("listings").update({ status: "hidden" }).eq("id", listingId);
  await supabase.from("reports").update({ status: "resolved" }).eq("listing_id", listingId).eq("status", "open");
  done("/admin/reports", "/admin/listings");
}

// Messages ------------------------------------------------------------------
export async function adminSetMessageStatus(id: string, status: "new" | "read" | "archived") {
  const supabase = await admin();
  await supabase.from("contact_messages").update({ status }).eq("id", id);
  done("/admin/messages");
}

export async function adminDeleteMessage(id: string) {
  const supabase = await admin();
  await supabase.from("contact_messages").delete().eq("id", id);
  done("/admin/messages");
}

// Notices -------------------------------------------------------------------
export async function adminCreateNotice(fd: FormData) {
  const supabase = await admin();
  const title = String(fd.get("title") ?? "").trim();
  const body = String(fd.get("body") ?? "").trim();
  if (!title) return;
  await supabase.from("notices").insert({ title, body, is_published: fd.get("is_published") === "on" });
  done("/admin/notices", "/notices");
}

export async function adminToggleNotice(id: string, published: boolean) {
  const supabase = await admin();
  await supabase.from("notices").update({ is_published: published }).eq("id", id);
  done("/admin/notices", "/notices");
}

export async function adminDeleteNotice(id: string) {
  const supabase = await admin();
  await supabase.from("notices").delete().eq("id", id);
  done("/admin/notices", "/notices");
}

// Settings ------------------------------------------------------------------
export async function adminUpdateSettings(fd: FormData) {
  const supabase = await admin();
  await supabase
    .from("site_settings")
    .update({
      require_approval: fd.get("require_approval") === "on",
      announcement: String(fd.get("announcement") ?? "").trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  done("/admin/settings");
}
