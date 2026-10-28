"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CATEGORIES, COUNTRIES, IMAGE_BUCKET, MAX_IMAGES, REPORT_REASONS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

type Result = { error?: string; ok?: boolean };

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

// ---------------------------------------------------------------------------
// Favorites
// ---------------------------------------------------------------------------
export async function toggleFavorite(listingId: string, save: boolean): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "auth" };

  const { error } = save
    ? await supabase.from("favorites").upsert({ user_id: user.id, listing_id: listingId })
    : await supabase.from("favorites").delete().eq("user_id", user.id).eq("listing_id", listingId);
  if (error) return { error: error.message };
  revalidatePath("/favorites");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------
export type ListingFormState = { error?: string; fieldErrors?: Record<string, string> };

function parseListing(fd: FormData) {
  const fieldErrors: Record<string, string> = {};
  const title = str(fd, "title");
  const description = str(fd, "description");
  const category = str(fd, "category");
  const country = str(fd, "country");
  const city = str(fd, "city") || null;
  const price_type = str(fd, "price_type") || "fixed";
  const priceRaw = str(fd, "price").replace(/,/g, "");
  const condition = str(fd, "condition") || null;
  const contact_phone = str(fd, "contact_phone") || null;
  const contact_whatsapp = str(fd, "contact_whatsapp") || null;
  let images: string[] = [];
  try {
    images = JSON.parse(str(fd, "images") || "[]");
  } catch {
    images = [];
  }

  if (title.length < 3) fieldErrors.title = "Give your ad a title (at least 3 characters).";
  if (title.length > 120) fieldErrors.title = "Keep the title under 120 characters.";
  if (description.length > 5000) fieldErrors.description = "Description is too long (max 5000 characters).";
  if (!CATEGORIES.some((c) => c.slug === category)) fieldErrors.category = "Choose a category.";
  if (!COUNTRIES.some((c) => c.code === country)) fieldErrors.country = "Choose a country.";
  if (!["fixed", "negotiable", "free", "contact"].includes(price_type)) fieldErrors.price_type = "Choose a price type.";

  let price: number | null = null;
  if (price_type === "fixed" || price_type === "negotiable") {
    price = Number(priceRaw);
    if (!priceRaw || isNaN(price) || price < 0) fieldErrors.price = "Enter a valid price.";
  }
  if (!Array.isArray(images) || images.length > MAX_IMAGES || images.some((u) => typeof u !== "string")) {
    fieldErrors.images = `Add up to ${MAX_IMAGES} photos.`;
  }
  const storagePrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${IMAGE_BUCKET}/`;
  images = images.filter((u) => typeof u === "string" && u.startsWith(storagePrefix));

  return {
    fieldErrors,
    values: {
      title,
      description,
      category,
      country,
      city,
      price_type,
      price,
      condition: condition === "new" || condition === "used" ? condition : null,
      contact_phone,
      contact_whatsapp,
      images,
    },
  };
}

export async function createListing(_: ListingFormState, fd: FormData): Promise<ListingFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in to post an ad." };

  const { fieldErrors, values } = parseListing(fd);
  if (Object.keys(fieldErrors).length) return { fieldErrors, error: "Please fix the highlighted fields." };

  const { data, error } = await supabase
    .from("listings")
    .insert({ ...values, user_id: user.id })
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/");
  redirect(`/listing/${data.id}?posted=1`);
}

export async function updateListing(id: string, _: ListingFormState, fd: FormData): Promise<ListingFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in." };

  const { fieldErrors, values } = parseListing(fd);
  if (Object.keys(fieldErrors).length) return { fieldErrors, error: "Please fix the highlighted fields." };

  const { error } = await supabase.from("listings").update(values).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/listing/${id}`);
  revalidatePath("/my-ads");
  redirect(`/listing/${id}?updated=1`);
}

export async function setListingStatus(id: string, status: "active" | "sold" | "hidden"): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("listings").update({ status }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/my-ads");
  revalidatePath(`/listing/${id}`);
  return { ok: true };
}

export async function deleteListing(id: string): Promise<Result> {
  const supabase = await createClient();
  const { data: listing } = await supabase.from("listings").select("images").eq("id", id).single();
  const { error } = await supabase.from("listings").delete().eq("id", id);
  if (error) return { error: error.message };
  await removeImages(supabase, listing?.images ?? []);
  revalidatePath("/my-ads");
  revalidatePath("/");
  return { ok: true };
}

async function removeImages(supabase: Awaited<ReturnType<typeof createClient>>, urls: string[]) {
  const marker = `/storage/v1/object/public/${IMAGE_BUCKET}/`;
  const paths = urls.map((u) => u.split(marker)[1]).filter(Boolean);
  if (paths.length) await supabase.storage.from(IMAGE_BUCKET).remove(paths);
}

export async function recordView(id: string) {
  const supabase = await createClient();
  await supabase.rpc("increment_listing_views", { listing_id: id });
}

// ---------------------------------------------------------------------------
// Reports and contact
// ---------------------------------------------------------------------------
export async function reportListing(listingId: string, reason: string, details: string): Promise<Result> {
  if (!REPORT_REASONS.includes(reason)) return { error: "Choose a reason." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("reports").insert({
    listing_id: listingId,
    reporter_id: user?.id ?? null,
    reason,
    details: details.slice(0, 2000) || null,
  });
  if (error) return { error: "Could not send report. Please try again." };
  return { ok: true };
}

export type ContactState = { error?: string; ok?: boolean };

export async function sendContactMessage(_: ContactState, fd: FormData): Promise<ContactState> {
  const name = str(fd, "name");
  const email = str(fd, "email");
  const subject = str(fd, "subject") || "General";
  const message = str(fd, "message");
  if (str(fd, "website")) return { ok: true }; // honeypot: silently drop bots
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || message.length < 5) {
    return { error: "Please fill in your name, a valid email and a message." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("contact_messages")
    .insert({ name, email, subject, message: message.slice(0, 5000), user_id: user?.id ?? null });
  if (error) return { error: "Could not send your message. Please try again." };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------
export type ProfileState = { error?: string; ok?: boolean };

export async function updateProfile(_: ProfileState, fd: FormData): Promise<ProfileState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in." };
  const full_name = str(fd, "full_name");
  if (full_name.length < 2) return { error: "Please enter your name." };
  const country = str(fd, "country");
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name,
      phone: str(fd, "phone") || null,
      whatsapp: str(fd, "whatsapp") || null,
      country: COUNTRIES.some((c) => c.code === country) ? country : null,
      city: str(fd, "city") || null,
      bio: str(fd, "bio").slice(0, 500) || null,
      avatar_url: str(fd, "avatar_url") || null,
    })
    .eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}
