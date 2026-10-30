// Adds demo payments, promotions, business accounts, staff and banner campaigns
// to a LOCAL database (run after seed-demo.mjs). Never run against the live site.
// Usage: SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-revenue-demo.mjs <banner-dir>
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const url = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error("Refusing to seed a non-local database.");
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const bannerDir = process.argv[2];
const day = 86400000;
const ago = (d) => new Date(Date.now() - d * day).toISOString();
const ahead = (d) => new Date(Date.now() + d * day).toISOString();
const dateOnly = (iso) => iso.slice(0, 10);
const must = ({ data, error }) => {
  if (error) throw error;
  return data;
};

async function main() {
  const profiles = must(await db.from("profiles").select("id, email, full_name"));
  const by = Object.fromEntries(profiles.map((p) => [p.email.split("@")[0], p.id]));
  const listings = must(await db.from("listings").select("id, title, country, user_id, images"));
  const L = (t) => listings.find((l) => l.title.includes(t));
  const plans = must(await db.from("plans").select("id, name"));
  const P = (n) => plans.find((p) => p.name.includes(n)).id;
  const pkgs = must(await db.from("boost_packages").select("id, name, kind"));
  const K = (n) => pkgs.find((p) => p.name.startsWith(n)).id;

  // Staff
  for (const [email, name, role] of [["losa@example.com", "Losa Vaai", "moderator"], ["tevita@example.com", "Tevita Lolo", "sales"]]) {
    const { data } = await db.auth.admin.createUser({ email, password: "Password123!", email_confirm: true, user_metadata: { full_name: name, country: "FJ" } });
    await db.from("profiles").update({ role }).eq("id", data.user.id);
  }

  // Where customers send money
  await db.from("site_settings").update({
    payment_details: {
      mpaisa_number: "912 3456 (example)",
      mycash_number: "712 3456 (example)",
      bank_name: "BSP Fiji (example)",
      bank_account_name: "Pacific Listing Ltd",
      bank_account_number: "1234567 (example)",
      bank_branch: "Suva City",
      instructions: "Use your order number as the payment reference so we can match your payment.",
    },
  }).eq("id", 1);

  // Business accounts
  await db.from("profiles").update({ business_name: "Suva Auto Traders", plan_id: P("Pro"), business_until: ahead(18) }).eq("id", by.mere);
  await db.from("profiles").update({ business_name: "Port Vila Tech", plan_id: P("Starter"), business_until: ahead(4) }).eq("id", by.john);

  // Six months of sales history
  const history = [];
  const kinds = [
    ["boost", "Featured · 7 days", 15, "mpaisa"],
    ["boost", "Bump to top", 5, "mycash"],
    ["boost", "Urgent badge · 7 days", 8, "mpaisa"],
    ["subscription", "Business Starter · 30 days", 49, "bank"],
    ["subscription", "Business Pro · 30 days", 129, "bank"],
    ["campaign", "Banner advertising", 600, "invoice"],
    ["posting_fee", "Posting fee", 10, "mpaisa"],
  ];
  const growth = [0.35, 0.5, 0.6, 0.75, 0.9, 1];
  for (let m = 5; m >= 0; m--) {
    const n = Math.round(14 * growth[5 - m]);
    for (let i = 0; i < n; i++) {
      const [kind, desc, amt, method] = kinds[(i * 3 + m) % kinds.length];
      const daysAgo = m * 30 + ((i * 7) % 27) + (m === 0 ? -1 : 0);
      const when = ago(Math.max(1, m === 0 ? Math.min(daysAgo, new Date().getDate() - 1 || 1) : daysAgo));
      history.push({
        user_id: [by.mere, by.sione, by.leilani, by.john][i % 4],
        kind,
        description: kind === "campaign" ? "Banner advertising: monthly package" : desc,
        amount: amt,
        currency: "FJD",
        method,
        status: "paid",
        payer_reference: method === "invoice" ? null : `MP${(240000 + i * 37 + m * 101).toString()}`,
        created_at: when,
        paid_at: when,
      });
    }
  }
  history.push({ user_id: by.leilani, kind: "boost", description: "Featured · 7 days: Beachfront villa", amount: 18, currency: "WST", method: "mpaisa", status: "paid", payer_reference: "MP883210", created_at: ago(12), paid_at: ago(12) });
  history.push({ user_id: by.sione, kind: "boost", description: "Bump to top: iPhone 13", amount: 5, currency: "TOP", method: "bank", status: "paid", payer_reference: "TDB-55120", created_at: ago(6), paid_at: ago(6) });
  history.push({ user_id: by.john, kind: "subscription", description: "Business Starter · 30 days", amount: 2600, currency: "VUV", method: "bank", status: "paid", payer_reference: "BRED-0912", created_at: ago(26), paid_at: ago(26), billing_name: "Port Vila Tech" });
  must(await db.from("orders").insert(history));

  // Ads promoted right now (each backed by a paid order)
  const promos = [
    [L("Tacoma"), "featured", 5, "Featured · 7 days", by.mere],
    [L("iPhone"), "featured", 3, "Featured · 7 days", by.sione],
    [L("headphones"), "urgent", 6, "Urgent badge · 7 days", by.mere],
    [L("Lost cat"), "urgent", 2, "Urgent badge · 7 days", by.sione],
  ];
  for (const [l, kind, days, pkgName, uid] of promos) {
    const patch = kind === "featured" ? { is_featured: true, featured_until: ahead(days) } : { is_urgent: true, urgent_until: ahead(days) };
    await db.from("listings").update(patch).eq("id", l.id);
    must(await db.from("orders").insert({
      user_id: uid, kind: "boost", description: `${pkgName}: ${l.title}`, listing_id: l.id, package_id: K(pkgName.split(" ·")[0]),
      amount: kind === "featured" ? 15 : 8, currency: "FJD", method: "mpaisa", status: "paid", payer_reference: "MP" + (700000 + days), created_at: ago(7 - days), paid_at: ago(7 - days),
    }));
  }

  // Waiting for staff to confirm
  const villa = L("Beachfront villa");
  must(await db.from("orders").insert([
    { user_id: by.leilani, kind: "boost", description: `Featured · 30 days: ${villa.title}`, listing_id: villa.id, package_id: K("Featured · 30"), amount: 54, currency: "WST", method: "mpaisa", payer_reference: "MP241029.0915.C55102", created_at: ago(0.2) },
    { user_id: by.john, kind: "subscription", description: "Business Starter · 30 days", plan_id: P("Starter"), amount: 2600, currency: "VUV", method: "bank", payer_reference: "BRED-1104", billing_name: "Port Vila Tech", created_at: ago(0.5) },
    { user_id: by.sione, kind: "subscription", description: "Business Pro · 30 days", plan_id: P("Pro"), amount: 135, currency: "TOP", method: "mpaisa", billing_name: "Tonga Marine Supplies", created_at: ago(1) },
  ]));

  // A property ad waiting for its posting fee
  const house = must(await db.from("listings").insert({
    user_id: by.leilani, title: "3-bedroom family home for rent, Vaitele", category: "property", price: 1800, price_type: "fixed", country: "WS", city: "Vaitele",
    description: "Spacious home with a big yard, close to shops and schools. Available from December.", images: villa.images.slice(0, 1),
    contact_phone: "+685 751 2345", status: "awaiting_payment", created_at: ago(0.1),
  }).select("id, title").single());
  must(await db.from("orders").insert({ user_id: by.leilani, kind: "posting_fee", description: `Posting fee: ${house.title}`, listing_id: house.id, amount: 12, currency: "WST", created_at: ago(0.1) }));

  // Banner campaigns
  const upload = async (file) => {
    const path = `${by.admin}/banner-${file}`;
    await db.storage.from("listing-images").upload(path, readFileSync(join(bannerDir, file)), { contentType: "image/jpeg", upsert: true });
    return db.storage.from("listing-images").getPublicUrl(path).data.publicUrl;
  };
  const campaigns = [
    { advertiser_name: "Island Hopper Air", advertiser_email: "marketing@example.com", title: "Fly the Pacific from FJD 199", image_url: await upload("island-hopper.jpg"), link_url: "https://example.com/flights", slot_code: "home_banner", countries: [], categories: [], starts_on: dateOnly(ago(10)), ends_on: dateOnly(ahead(20)), status: "active", amount: 1800, currency: "FJD", impressions: 18240, clicks: 512 },
    { advertiser_name: "Apia Hardware Co.", advertiser_email: "sales@example.com", title: "Building season sale: 20% off", image_url: await upload("apia-hardware.jpg"), link_url: "https://example.com/hardware", slot_code: "home_banner", countries: ["WS"], categories: [], starts_on: dateOnly(ago(5)), ends_on: dateOnly(ahead(23)), status: "active", amount: 720, currency: "WST", impressions: 2310, clicks: 61 },
    { advertiser_name: "Suva Motors", advertiser_email: "service@example.com", title: "4x4 tyres fitted from FJD 289", image_url: await upload("suva-motors.jpg"), link_url: "https://example.com/tyres", slot_code: "category_top", countries: ["FJ"], categories: ["vehicles"], starts_on: dateOnly(ago(14)), ends_on: dateOnly(ahead(14)), status: "active", amount: 320, currency: "FJD", impressions: 6120, clicks: 198 },
    { advertiser_name: "Coral Coast Resort", advertiser_email: "stay@example.com", title: "Stay 3, pay 2", image_url: await upload("coral-coast.jpg"), link_url: "https://example.com/resort", slot_code: "listing_sidebar", countries: [], categories: [], starts_on: dateOnly(ago(3)), ends_on: dateOnly(ahead(25)), status: "active", amount: 720, currency: "FJD", impressions: 4870, clicks: 133 },
    { advertiser_name: "Nadi Realty", advertiser_email: "hello@example.com", title: "Homes for sale in Nadi", image_url: null, link_url: "https://example.com/realty", slot_code: "category_top", countries: ["FJ"], categories: ["property"], starts_on: dateOnly(ahead(3)), ends_on: dateOnly(ahead(31)), status: "awaiting_payment", amount: 320, currency: "FJD", notes: "Agreed 4 weeks. Invoice sent by email.", impressions: 0, clicks: 0 },
  ];
  const created = must(await db.from("ad_campaigns").insert(campaigns.map((c) => ({ ...c, created_by: by.tevita }))).select("id, advertiser_name, amount, currency, status"));
  const nadi = created.find((c) => c.advertiser_name === "Nadi Realty");
  must(await db.from("orders").insert({ kind: "campaign", description: "Banner advertising: Homes for sale in Nadi", campaign_id: nadi.id, amount: 320, currency: "FJD", method: "invoice", billing_name: "Nadi Realty", billing_email: "hello@example.com", created_at: ago(1) }));
  for (const c of created.filter((c) => c.status === "active")) {
    must(await db.from("orders").insert({ kind: "campaign", description: `Banner advertising: ${c.advertiser_name}`, campaign_id: c.id, amount: c.amount, currency: c.currency, method: "invoice", status: "paid", billing_name: c.advertiser_name, created_at: ago(11), paid_at: ago(10) }));
  }

  // Staff notes, an enquiry and some recent activity
  await db.from("user_notes").insert([
    { user_id: by.john, author_id: by.tevita, body: "Interested in Business Pro next month. Follow up when Starter ends.", created_at: ago(2) },
    { user_id: by.sione, author_id: by.losa, body: "Asked to remove a duplicate phone ad. Done, user was helpful.", created_at: ago(9) },
  ]);
  await db.from("contact_messages").insert({ name: "Mele", email: "mele@example.com", subject: "Advertising & business", message: "Hi, we run a travel agency in Nuku'alofa. Could you send prices for a banner shown in Tonga for 3 months?" });
  await db.from("audit_log").insert([
    { actor_id: by.tevita, action: "campaign.create", target_type: "campaign", target_id: nadi.id, details: { title: "Homes for sale in Nadi" }, created_at: ago(1) },
    { actor_id: by.tevita, action: "order.paid", target_type: "order", details: {}, created_at: ago(2) },
    { actor_id: by.losa, action: "listing.active", target_type: "listing", target_id: L("Smart watch")?.id, details: {}, created_at: ago(3) },
    { actor_id: by.admin, action: "pricing.package", target_type: "package", details: { name: "Featured · 7 days" }, created_at: ago(4) },
    { actor_id: by.admin, action: "user.role", target_type: "user", target_id: by.tevita, details: { role: "sales" }, created_at: ago(20) },
  ]);
  console.log("Seeded revenue demo:", history.length, "past orders,", created.length, "campaigns");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
