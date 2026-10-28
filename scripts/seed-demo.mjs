// Loads demo users, listings and photos into a LOCAL Supabase for testing.
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-demo.mjs <photo-dir>
// Do not run this against the live database.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const url = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error("Refusing to seed a non-local database.");
const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const photoDir = process.argv[2];

const USERS = [
  { email: "admin@pacificlisting.test", name: "Site Admin", country: "FJ", city: "Suva", admin: true },
  { email: "mere@example.com", name: "Mere Tuilagi", country: "FJ", city: "Suva", phone: "+679 912 3456", verified: true },
  { email: "sione@example.com", name: "Sione Fifita", country: "TO", city: "Nuku'alofa", phone: "+676 771 2345" },
  { email: "leilani@example.com", name: "Leilani Aufai", country: "WS", city: "Apia", phone: "+685 751 2345", verified: true },
  { email: "john@example.com", name: "John Kalo", country: "VU", city: "Port Vila", phone: "+678 551 234" },
];

const day = 86400000;
const LISTINGS = [
  { u: 1, title: "2018 Toyota Tacoma TRD Off-Road 4x4", category: "vehicles", price: 68500, price_type: "negotiable", condition: "used", photos: ["1559416523-140ddc3d238c"], featured: true, age: 0.2,
    description: "Well looked after Tacoma, 72,000 km, full service history. New all-terrain tyres, tow bar, canopy available separately.\n\nRegistered until June. Viewing in Suva, weekdays after 5pm." },
  { u: 3, title: "Luxury motor yacht — 52ft, sleeps 6", category: "boats", price: 1450000, price_type: "negotiable", condition: "used", photos: ["1567899378494-47b22a2ae96a"], featured: true, age: 1,
    description: "Beautiful 52ft motor yacht moored in Apia. Twin diesels, generator, watermaker. Ideal for charters. Serious enquiries only." },
  { u: 1, title: "Modern 4-bedroom home with pool, Tamavua", category: "property", price: 1200000, price_type: "fixed", photos: ["1580587771525-78b9dba3b914", "1600596542815-ffad4c1539a9"], featured: true, age: 2,
    description: "Architect-designed family home on a quiet street with harbour views. 4 bedrooms, 3 bathrooms, open-plan kitchen, double garage and saltwater pool." },
  { u: 2, title: "iPhone 13 – 128GB, unlocked", category: "electronics", price: 1450, price_type: "fixed", condition: "used", photos: ["1511707171634-5f897ff02aa9"], featured: true, age: 0.1,
    description: "Excellent condition, always in a case with screen protector. Battery health 89%. Comes with box and charging cable." },
  { u: 4, title: "Ford Expedition 2016, 7 seater", category: "vehicles", price: 3200000, price_type: "negotiable", condition: "used", photos: ["1533473359331-0135ef1b58bf"], age: 0.5,
    description: "Spacious family SUV, very reliable. Recently serviced, aircon cold. Perfect for island roads." },
  { u: 1, title: "Green velvet 3-seater sofa", category: "home-garden", price: 900, price_type: "negotiable", condition: "used", photos: ["1555041469-a586c61ea9bc"], age: 3,
    description: "Comfortable mid-century style sofa, only 1 year old. Moving overseas so must go. Pick up from Nadi." },
  { u: 3, title: "Beachfront villa for rent — weekly or monthly", category: "property", price: 3500, price_type: "fixed", photos: ["1512917774080-9991f1c4c750"], age: 1.5,
    description: "Fully furnished 3-bedroom villa right on the beach. WiFi, aircon, pool. Weekly rate shown, monthly discounts available." },
  { u: 2, title: "Beagle puppy looking for a loving home", category: "pets", price: null, price_type: "free", photos: ["1543466835-00a7907e9de1"], age: 0.8,
    description: "Friendly 10-week-old beagle, vaccinated and dewormed. Free to a good home with a fenced yard." },
  { u: 1, title: "Construction labourers wanted — Suva site", category: "jobs", price: null, price_type: "contact", photos: ["1504307651254-35680f356dfd"], age: 0.3,
    description: "We are hiring 5 experienced labourers for a 6-month commercial project in Suva. Safety boots supplied. Call to apply." },
  { u: 3, title: "House cleaning service — reliable & affordable", category: "services", price: 60, price_type: "fixed", photos: ["1581578731548-c64695cc6952"], age: 4,
    description: "Professional home and office cleaning in Apia. Price is per visit (up to 3 hours). Own supplies included." },
  { u: 4, title: "MacBook Pro 14\" M1 Pro, 16GB/512GB", category: "electronics", price: 290000, price_type: "fixed", condition: "used", photos: ["1517336714731-489689fd1ca8", "1496181133206-80ce9b88a853"], age: 2.5,
    description: "Great for design and video work. Battery cycles under 200. No scratches. Includes charger." },
  { u: 2, title: "Nike running shoes, size 10 — brand new", category: "fashion", price: 220, price_type: "fixed", condition: "new", photos: ["1542291026-7eec264c27ff"], age: 5,
    description: "Never worn, still with tags. Wrong size gift." },
  { u: 1, title: "Wireless headphones – noise cancelling", category: "electronics", price: 320, price_type: "negotiable", condition: "used", photos: ["1505740420928-5e560c06d30e"], age: 6,
    description: "Great sound, 30h battery life. Used for a few months only." },
  { u: 3, title: "Scuba diving lessons — PADI Open Water", category: "services", price: 950, price_type: "fixed", photos: ["1544551763-46a013bb70d5"], age: 7,
    description: "Learn to dive in the clearest water in the Pacific. 3-day course including all gear and boat dives." },
  { u: 4, title: "Yellow accent armchair", category: "home-garden", price: 15000, price_type: "fixed", condition: "new", photos: ["1586023492125-27b2c045efd7"], age: 8,
    description: "Brand new, still wrapped. Brightens up any room." },
  { u: 2, title: "Lost cat — black & white, near Lami", category: "lost-found", price: null, price_type: "free", photos: ["1514888286974-6c03e2ca1dba"], age: 0.4,
    description: "Our cat 'Bubu' went missing on Tuesday near Lami bus stop. Very friendly. Reward offered — please call if seen!" },
  { u: 4, title: "Smart watch — pair of 2", category: "electronics", price: 18000, price_type: "fixed", condition: "new", photos: ["1523275335684-37898b6baf30"], age: 0.05, status: "pending",
    description: "Two new smart watches, black and white. Sealed." },
];

async function main() {
  const ids = [];
  for (const u of USERS) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.admin ? "Admin12345!" : "Password123!",
      email_confirm: true,
      user_metadata: { full_name: u.name, country: u.country, phone: u.phone },
    });
    if (error) throw error;
    ids.push(data.user.id);
    await supabase
      .from("profiles")
      .update({ city: u.city, whatsapp: u.phone, role: u.admin ? "admin" : "user", is_verified: !!u.verified })
      .eq("id", data.user.id);
  }

  for (const l of LISTINGS) {
    const userId = ids[l.u];
    const images = [];
    for (const p of l.photos) {
      const path = `${userId}/${p}.jpg`;
      await supabase.storage.from("listing-images").upload(path, readFileSync(join(photoDir, `${p}.jpg`)), { contentType: "image/jpeg", upsert: true });
      images.push(supabase.storage.from("listing-images").getPublicUrl(path).data.publicUrl);
    }
    const user = USERS[l.u];
    const created = new Date(Date.now() - l.age * day).toISOString();
    const { error } = await supabase.from("listings").insert({
      user_id: userId,
      title: l.title,
      description: l.description,
      category: l.category,
      price: l.price,
      price_type: l.price_type,
      condition: l.condition ?? null,
      country: user.country,
      city: user.city,
      images,
      contact_phone: user.phone,
      contact_whatsapp: user.phone,
      status: l.status ?? "active",
      is_featured: !!l.featured,
      views: Math.floor(Math.random() * 300),
      created_at: created,
    });
    if (error) throw error;
  }

  await supabase.from("notices").insert([
    { title: "Community beach clean-up — Saturday 8am", body: "Join us at My Suva Park this Saturday. Gloves and bags provided. Vinaka!" },
    { title: "Welcome to the new Pacific Listing", body: "We've rebuilt the site to be faster and easier to use. Post your ads for free and let us know what you think." },
  ]);
  const { data: listing } = await supabase.from("listings").select("id").eq("category", "fashion").limit(1).single();
  await supabase.from("reports").insert({ listing_id: listing.id, reason: "Scam or fraud", details: "Seller asked me to pay a deposit by bank transfer first." });
  await supabase.from("contact_messages").insert({ name: "Ana", email: "ana@example.com", subject: "Feedback & suggestions", message: "Love the new site! Could you add a category for farm produce?" });
  console.log("Seeded", USERS.length, "users and", LISTINGS.length, "listings.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
