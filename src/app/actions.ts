"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CATEGORIES, COUNTRIES, IMAGE_BUCKET, MAX_IMAGES, REPORT_REASONS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { SUPABASE_URL } from "@/lib/supabase/env";

type Result = { error?: string; ok?: boolean };

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

/** What was typed, sent back with an error so the form can keep it (React clears submitted forms). */
const typed = (fd: FormData) =>
  Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;

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
export type ListingFormState = { error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> };

function parseListing(fd: FormData) {
  const fieldErrors: Record<string, string> = {};
  const title = str(fd, "title");
  const description = str(fd, "description");
  const category = str(fd, "category");
  const subcategory = str(fd, "subcategory") || null;
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
  const cat = CATEGORIES.find((c) => c.slug === category);
  if (!cat) fieldErrors.category = "Choose a category.";
  else if (cat.subcategories.length && !cat.subcategories.some((s) => s.slug === subcategory)) {
    fieldErrors.category = `Choose what kind of ${cat.name.toLowerCase()} this is.`;
  }
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
  const storagePrefix = `${SUPABASE_URL}/storage/v1/object/public/${IMAGE_BUCKET}/`;
  images = images.filter((u) => typeof u === "string" && u.startsWith(storagePrefix));

  return {
    fieldErrors,
    values: {
      title,
      description,
      category,
      subcategory: cat?.subcategories.length ? subcategory : null,
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
  if (Object.keys(fieldErrors).length) return { fieldErrors, error: "Please fix the highlighted fields.", values: typed(fd) };

  const { data, error } = await supabase
    .from("listings")
    .insert({ ...values, user_id: user.id })
    .select("id, status")
    .single();
  if (error) return { error: error.message, values: typed(fd) };

  revalidatePath("/");
  if (data.status === "awaiting_payment") {
    // This category has a posting fee: send them to pay for it.
    const { data: order } = await supabase
      .from("orders")
      .select("id")
      .eq("listing_id", data.id)
      .eq("kind", "posting_fee")
      .maybeSingle();
    if (order) redirect(`/orders/${order.id}?new=1`);
  }
  redirect(`/listing/${data.id}?posted=1`);
}

export async function updateListing(id: string, _: ListingFormState, fd: FormData): Promise<ListingFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in." };

  const { fieldErrors, values } = parseListing(fd);
  if (Object.keys(fieldErrors).length) return { fieldErrors, error: "Please fix the highlighted fields.", values: typed(fd) };

  const { error } = await supabase.from("listings").update(values).eq("id", id);
  if (error) return { error: error.message, values: typed(fd) };

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

export type ContactState = { error?: string; ok?: boolean; values?: Record<string, string> };

export async function sendContactMessage(_: ContactState, fd: FormData): Promise<ContactState> {
  const name = str(fd, "name");
  const email = str(fd, "email");
  const subject = str(fd, "subject") || "General";
  const message = str(fd, "message");
  if (str(fd, "website")) return { ok: true }; // honeypot: silently drop bots
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || message.length < 5) {
    return { error: "Please fill in your name, a valid email and a message.", values: typed(fd) };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("contact_messages")
    .insert({ name, email, subject, message: message.slice(0, 5000), user_id: user?.id ?? null });
  if (error) return { error: "Could not send your message. Please try again.", values: typed(fd) };
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

// ---------------------------------------------------------------------------
// Promotions, business accounts and payments
// ---------------------------------------------------------------------------
export type OrderState = { error?: string; ok?: boolean };

export async function createBoostOrder(_: OrderState, fd: FormData): Promise<OrderState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in." };
  const { data, error } = await supabase.rpc("create_boost_order", {
    p_listing: str(fd, "listing_id"),
    p_package: str(fd, "package_id"),
    p_method: str(fd, "method") || "mpaisa",
  });
  if (error) return { error: error.message };
  revalidatePath("/my-ads");
  redirect(`/orders/${data}`);
}

export async function createSubscriptionOrder(_: OrderState, fd: FormData): Promise<OrderState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in." };
  const { data, error } = await supabase.rpc("create_subscription_order", {
    p_plan: str(fd, "plan_id"),
    p_method: str(fd, "method") || "mpaisa",
    p_business_name: str(fd, "business_name"),
    p_currency: str(fd, "currency") || null,
  });
  if (error) return { error: error.message };
  redirect(`/orders/${data}`);
}

export async function submitPayment(orderId: string, _: OrderState, fd: FormData): Promise<OrderState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_payment", {
    p_order: orderId,
    p_method: str(fd, "method"),
    p_reference: str(fd, "reference"),
  });
  if (error) return { error: error.message };
  revalidatePath(`/orders/${orderId}`);
  return { ok: true };
}

export async function cancelOrder(orderId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_my_order", { p_order: orderId });
  if (error) return { error: error.message };
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Account deletion (required by the app stores)
// ---------------------------------------------------------------------------
export type DeleteAccountState = { error?: string };

export async function deleteMyAccount(_: DeleteAccountState, fd: FormData): Promise<DeleteAccountState> {
  if (str(fd, "confirm").toUpperCase() !== "DELETE") return { error: 'Type DELETE in capitals to confirm.' };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in." };

  // Remove their photos first; the database can't delete stored files itself.
  const bucket = supabase.storage.from(IMAGE_BUCKET);
  for (let round = 0; round < 20; round++) {
    const { data: files } = await bucket.list(user.id, { limit: 100 });
    if (!files?.length) break;
    await bucket.remove(files.map((f) => `${user.id}/${f.name}`));
    if (files.length < 100) break;
  }

  const { error } = await supabase.rpc("delete_my_account");
  if (error) {
    return {
      error: /could not find|does not exist/i.test(error.message)
        ? "Account deletion isn't switched on yet. Please contact support and we'll delete it for you."
        : error.message,
    };
  }
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/account-deleted");
}
