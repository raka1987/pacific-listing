import type { SupabaseClient } from "@supabase/supabase-js";

// Phone numbers are only readable through database functions that decide what each viewer may see
// (see supabase/migrations/20261117000000_private_numbers.sql).

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

type MyContact = { phone: string | null; whatsapp: string | null };
type MyListingContact = { contact_phone: string | null; contact_whatsapp: string | null; phone_private: boolean };

export async function getListingContact(supabase: SupabaseClient, listingId: string) {
  const { data } = await supabase.rpc("get_listing_contact", { p_listing: listingId });
  return (data as ListingContact | null) ?? null;
}

export async function getMyContact(supabase: SupabaseClient): Promise<MyContact> {
  const { data } = await supabase.rpc("my_contact");
  return (data as MyContact | null) ?? { phone: null, whatsapp: null };
}

export async function getMyListingContact(supabase: SupabaseClient, listingId: string): Promise<MyListingContact> {
  const { data } = await supabase.rpc("my_listing_contact", { p_listing: listingId });
  return (data as MyListingContact | null) ?? { contact_phone: null, contact_whatsapp: null, phone_private: false };
}
