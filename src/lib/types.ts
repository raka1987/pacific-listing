export type ListingStatus = "pending" | "active" | "sold" | "hidden" | "rejected";
export type PriceType = "fixed" | "negotiable" | "free" | "contact";

export type Profile = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  phone: string | null;
  whatsapp: string | null;
  country: string | null;
  city: string | null;
  bio: string | null;
  role: "user" | "admin";
  is_banned: boolean;
  is_verified: boolean;
  created_at: string;
};

export type Listing = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: string;
  price: number | null;
  price_type: PriceType;
  condition: "new" | "used" | null;
  country: string;
  city: string | null;
  images: string[];
  contact_phone: string | null;
  contact_whatsapp: string | null;
  status: ListingStatus;
  rejection_reason: string | null;
  is_featured: boolean;
  views: number;
  created_at: string;
  updated_at: string;
};

export type ListingWithSeller = Listing & {
  seller: Pick<Profile, "id" | "full_name" | "avatar_url" | "is_verified" | "created_at" | "phone" | "whatsapp"> | null;
};

export type Notice = { id: string; title: string; body: string; is_published: boolean; created_at: string };

// Columns that can be read from `profiles` by API clients (email is private).
export const PROFILE_COLUMNS =
  "id, full_name, avatar_url, phone, whatsapp, country, city, bio, role, is_banned, is_verified, created_at";

export const LISTING_CARD_COLUMNS =
  "id, title, price, price_type, category, country, city, images, status, is_featured, created_at, condition";

export type ListingCardData = Pick<
  Listing,
  "id" | "title" | "price" | "price_type" | "category" | "country" | "city" | "images" | "status" | "is_featured" | "created_at" | "condition"
>;
