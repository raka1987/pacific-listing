import type { SupabaseClient } from "@supabase/supabase-js";

// Phone numbers are read through database functions that decide what each viewer may see.
// The fallbacks keep things working on a database that hasn't had the private-numbers update yet.

export type ListingContact = {
  private: boolean;
  /** True when this viewer may see the full numbers. */
  visible: boolean;
  /** True when the seller has shared their number with this buyer in a chat. */
  shared: boolean;
  phone: string | null;
  whatsapp: string | null;
  masked_phone: string | null;
  masked_whatsapp: string | null;
};

const missingFunction = (e: { message?: string; code?: string } | null) => !!e && (e.code === "PGRST202" || /function|schema cache/i.test(e.message ?? ""));

export async function getListingContact(supabase: SupabaseClient, listingId: string): Promise<ListingContact | null> {
  const { data, error } = await supabase.rpc("get_listing_contact", { p_listing: listingId });
  if (!error) return (data as ListingContact | null) ?? null;
  if (!missingFunction(error)) return null;
  const { data: l } = await supabase
    .from("listings")
    .select("contact_phone, contact_whatsapp, seller:profiles!listings_user_id_fkey(phone, whatsapp)")
    .eq("id", listingId)
    .maybeSingle();
  const row = l as unknown as { contact_phone: string | null; contact_whatsapp: string | null; seller: { phone: string | null; whatsapp: string | null } | null } | null;
  const phone = row?.contact_phone || row?.seller?.phone || null;
  const whatsapp = row?.contact_whatsapp || row?.seller?.whatsapp || null;
  return { private: false, visible: true, shared: false, phone, whatsapp, masked_phone: phone, masked_whatsapp: whatsapp };
}

export async function getMyContact(supabase: SupabaseClient, userId: string): Promise<{ phone: string | null; whatsapp: string | null }> {
  const { data, error } = await supabase.rpc("my_contact");
  if (!error && data) return data as { phone: string | null; whatsapp: string | null };
  const { data: p } = await supabase.from("profiles").select("phone, whatsapp").eq("id", userId).maybeSingle();
  return { phone: (p?.phone as string) ?? null, whatsapp: (p?.whatsapp as string) ?? null };
}

export async function getMyListingContact(
  supabase: SupabaseClient,
  listingId: string,
): Promise<{ contact_phone: string | null; contact_whatsapp: string | null; phone_private: boolean }> {
  const { data, error } = await supabase.rpc("my_listing_contact", { p_listing: listingId });
  if (!error && data) return data as { contact_phone: string | null; contact_whatsapp: string | null; phone_private: boolean };
  const { data: l } = await supabase.from("listings").select("contact_phone, contact_whatsapp").eq("id", listingId).maybeSingle();
  return { contact_phone: (l?.contact_phone as string) ?? null, contact_whatsapp: (l?.contact_whatsapp as string) ?? null, phone_private: false };
}
