export type ListingStatus = "awaiting_payment" | "pending" | "active" | "sold" | "hidden" | "rejected";
export type Role = "user" | "admin" | "moderator" | "sales";
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
  role: Role;
  business_name: string | null;
  business_until: string | null;
  plan_id: string | null;
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
  subcategory: string | null;
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
  featured_until: string | null;
  is_urgent: boolean;
  urgent_until: string | null;
  sort_at: string;
  views: number;
  previous_price: number | null;
  price_dropped_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ListingWithSeller = Listing & {
  seller: Pick<Profile, "id" | "full_name" | "avatar_url" | "is_verified" | "created_at" | "phone" | "whatsapp" | "business_name" | "business_until"> | null;
};

export type Notice = { id: string; title: string; body: string; is_published: boolean; created_at: string };

// Columns that can be read from `profiles` by API clients (email is private).
export const PROFILE_COLUMNS =
  "id, full_name, avatar_url, phone, whatsapp, country, city, bio, role, is_banned, is_verified, created_at, business_name, business_until, plan_id";

export const LISTING_CARD_COLUMNS =
  "id, title, price, price_type, category, subcategory, country, city, images, status, is_featured, is_urgent, created_at, condition, previous_price, price_dropped_at";

export type ListingCardData = Pick<
  Listing,
  "id" | "title" | "price" | "price_type" | "category" | "subcategory" | "country" | "city" | "images" | "status" | "is_featured" | "is_urgent" | "created_at" | "condition" | "previous_price" | "price_dropped_at"
>;

export type Prices = Record<string, number>;

export type BoostPackage = {
  id: string;
  kind: "featured" | "bump" | "urgent";
  name: string;
  description: string;
  duration_days: number | null;
  prices: Prices;
  is_active: boolean;
  sort: number;
};

export type Plan = {
  id: string;
  name: string;
  description: string;
  features: string[];
  prices: Prices;
  duration_days: number;
  max_active_ads: number | null;
  free_bumps: number;
  waive_posting_fees: boolean;
  is_active: boolean;
  sort: number;
};

export type AdSlot = {
  code: string;
  name: string;
  description: string;
  size_hint: string;
  /** Per week, shown in one country */
  prices: Prices;
  /** Per week, shown in every country */
  global_prices: Prices;
  is_active: boolean;
  sort: number;
};

export type Campaign = {
  id: string;
  advertiser_name: string;
  advertiser_email: string | null;
  advertiser_phone: string | null;
  title: string;
  image_url: string | null;
  link_url: string | null;
  slot_code: string;
  countries: string[];
  categories: string[];
  starts_on: string;
  ends_on: string;
  status: "draft" | "awaiting_payment" | "active" | "paused" | "ended";
  amount: number | null;
  currency: string;
  impressions: number;
  clicks: number;
  notes: string | null;
  created_at: string;
};

export type OrderStatus = "awaiting_payment" | "paid" | "cancelled" | "refunded";

export type Order = {
  id: string;
  order_number: string;
  user_id: string | null;
  kind: "boost" | "subscription" | "campaign" | "posting_fee";
  description: string;
  listing_id: string | null;
  package_id: string | null;
  plan_id: string | null;
  campaign_id: string | null;
  amount: number;
  currency: string;
  method: PaymentMethod | null;
  status: OrderStatus;
  payer_reference: string | null;
  billing_name: string | null;
  billing_email: string | null;
  admin_note: string | null;
  paid_at: string | null;
  created_at: string;
};

export type PaymentMethod = "mpaisa" | "mycash" | "bank" | "card" | "cash" | "invoice" | "free";

export type PaymentDetails = {
  mpaisa_number?: string;
  mycash_number?: string;
  bank_name?: string;
  bank_account_name?: string;
  bank_account_number?: string;
  bank_branch?: string;
  instructions?: string;
};
