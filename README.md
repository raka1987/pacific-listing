# Pacific Listing

A free classifieds marketplace for the Pacific Islands, with an admin panel to manage listings, users, reports, messages and the notice board.

- **Website:** Next.js 15 (React), styled with Tailwind CSS
- **Database, logins and photo storage:** [Supabase](https://supabase.com)
- **Hosting:** [Vercel](https://vercel.com) (recommended, free to start)

---

## Going live: step by step

You need three free accounts: **GitHub**, **Supabase** and **Vercel**. Allow about 30–45 minutes.

### 1. Put the code on GitHub
1. Create a GitHub account at https://github.com and make a new **private** repository called `pacific-listing`.
2. Upload this folder to it (GitHub's "uploading an existing file" link works, or ask a developer or Claude to push it).

### 2. Create the database (Supabase)
1. Sign up at https://supabase.com and click **New project**. Pick the region closest to your users (for example **Sydney**).
2. When it's ready, open **Database → Extensions** and turn on **pg_cron** (it ends promotions and banner campaigns on time).
   Then open **SQL Editor**, then **New query**, and run each file in `supabase/migrations/` **in order**, pasting the whole file and clicking **Run** each time:
   `20261028000000_init.sql`, then `20261030000000_revenue.sql`, then `20261030010000_location.sql`.
   This creates all tables, security rules, prices and photo storage.
3. Open **Project Settings → API** and copy the **Project URL** and the **anon public** key. You need them in step 3.
4. Open **Authentication → URL Configuration**:
   - **Site URL:** `https://pacificlisting.com`
   - **Redirect URLs:** add `https://pacificlisting.com/**`
5. (Recommended) Under **Authentication → Emails → SMTP Settings**, connect an email sender such as Resend, Brevo or Zoho. Supabase's built-in email only sends a few messages per hour, which is fine for testing but not for a live site.

### 3. Put the website online (Vercel)
1. Sign up at https://vercel.com using your GitHub account, click **Add New → Project** and import `pacific-listing`.
2. Under **Environment Variables**, add:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL from Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key from Supabase |
   | `NEXT_PUBLIC_SITE_URL` | `https://pacificlisting.com` |
   | `NEXT_PUBLIC_SUPPORT_EMAIL` | the email you want people to contact |

3. Click **Deploy**. You'll get a temporary address such as `pacific-listing.vercel.app`. Check that everything works there first.

### 4. Make yourself the admin
1. On the new site, **sign up** with your own email.
2. In Supabase, open **SQL Editor** and run (with your email):
   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```
3. Log out and back in. **Admin panel** now appears in your account menu, or go to `/admin`.

### 5. Point pacificlisting.com at the new site
Your domain is registered at **Namecheap**, but its DNS is currently managed by **Hostinger** (the nameservers are `*.dns-parking.com`).

1. In Vercel, open the project, then **Settings → Domains**, and add `pacificlisting.com` and `www.pacificlisting.com`. Vercel shows the records it needs.
2. In Namecheap, open **Domain List → pacificlisting.com → Nameservers**, choose **Namecheap BasicDNS** and save. This moves DNS control from Hostinger to Namecheap.
3. Under **Advanced DNS**, delete the old A records and add the records Vercel showed you. Usually that's:
   - `A` record, host `@`, value `76.76.21.21`
   - `CNAME` record, host `www`, value `cname.vercel-dns.com`
4. Wait 15 minutes to a few hours. Vercel turns on HTTPS automatically.

> **Before you switch:** the old site's users, listings and mobile apps use the previous developer's database. Switching the domain replaces that site. If you can get an export of the old data from the developer, it can be imported.

---

## The mobile app

The site is an installable web app (a "PWA"):

- **Android (Chrome):** visitors see an **Install** banner, or can use the browser menu, then **Install app**.
- **iPhone (Safari):** visitors tap **Share**, then **Add to Home Screen**. The site shows these steps when they tap "Add to iPhone".
- Once installed it gets its own icon, opens full-screen with no browser bar, caches photos to save data, and shows a friendly page when there's no connection.

### Getting into the App Store and Google Play (optional, later)
The same site can be wrapped as a store app with [Capacitor](https://capacitorjs.com). You'll need:
- **Google Play developer account:** US$25 one-time
- **Apple developer account:** US$99 per year
- A Mac with Xcode, or a cloud build service (for example Codemagic or Ionic Appflow), to build the iPhone version

Apple can reject apps that are just a website in a frame. Adding native features such as push notifications ("someone saved your ad") and camera upload improves the chances of approval.

---

## Making money

Everything is managed in the admin panel under **Revenue**. Example prices are filled in; change them before launch.

| What | Who pays | Where you manage it |
|---|---|---|
| **Promotions**: Featured, Bump to top, Urgent badge | Sellers, from **My ads → Promote** | Promotions & fees |
| **Posting fees** for chosen categories (Property and Jobs are on by default) | Sellers, after posting | Promotions & fees |
| **Business accounts**: more ads, free bumps, no posting fees, business badge | Shops, agents, car yards, at `/business` | Business plans |
| **Banner ads** in three spots, for one country or **global** (all countries) | Advertisers you sell to directly | Banner ads |

**How payments work.** The customer picks M-PAiSA, MyCash or bank transfer, sends the money using their order number as the reference, and enters the transaction number. It appears under **Payments → To confirm**. When you see the money arrive, click **Mark paid** and whatever they bought switches on immediately. Put your real account numbers in **Settings → How customers pay you**. Card payments can be switched on later, once a developer connects your bank's payment gateway.

**Prices per country.** Every price can be set in each Pacific currency (there's a button to fill the others in from the FJD price). Visitors see prices in the currency of where they are.

**Location.** The site detects the visitor's country from their connection (on Vercel this works automatically), and visitors can change it with the flag button in the header. This decides:
- prices shown on Business accounts and Advertise pages,
- an approximate conversion under ads from other countries (for example "≈ WST 120"),
- which banner ads they see: a country banner only reaches visitors in that country, while a global banner reaches everyone.

**Staff roles** (set on a user's page under Users & staff):
- **Moderator:** listings, reports, messages and notice board; can't see money.
- **Sales:** payments, promotions, banner ads and business plans.
- **Admin:** everything, including users, roles, settings and the activity log.

---

## Using the admin panel (`/admin`)

| Section | What you can do |
|---|---|
| **Dashboard** | Live ads, new users, ads per day and per category, and items needing attention |
| **Listings** | Search and filter every ad; approve, reject (with reason), hide, feature on the homepage, or delete |
| **Users** | Search by name, email or phone; verify sellers (blue tick), ban/unban, give or remove admin access |
| **Reports** | Ads flagged by visitors; hide or delete the ad, or mark the report resolved or dismissed |
| **Messages** | Contact-form messages; reply by email, mark read, archive |
| **Notice board** | Post community notices shown on the homepage and `/notices` |
| **Settings** | Turn on "review ads before they go live", and set a site-wide announcement banner |

Banning a user hides all of their ads automatically. Supabase's own dashboard is always available too, for anything the admin panel doesn't cover.

---

## For developers

```bash
npm install
cp .env.example .env.local        # fill in Supabase keys
npm run dev                       # http://localhost:3000
```

Local database with Docker: `npx supabase start`, then use the printed URL and anon key. To load demo data **locally only**:
`SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-demo.mjs <folder-of-jpgs>`, then
`SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-revenue-demo.mjs <folder-of-banner-jpgs>` for payments, staff and campaigns.
The script needs these photo filenames: see `LISTINGS[].photos`.

**Security model:** every table uses Postgres row-level security. Users can only change their own ads and profile. Triggers stop users from featuring their own ads, approving themselves, or making themselves admin. Profile emails can't be read through the public API. Admin actions are checked both in the server code and in the database.

**Structure**
- `src/app/(site)` – public pages (home, search, category, listing, post/edit, account, info pages)
- `src/app/admin` – admin panel
- `src/app/actions.ts`, `src/app/admin/actions.ts` – server actions (all writes)
- `src/lib/constants.ts` – categories, countries/currencies, site name. Edit here to add a category or country.
- `supabase/migrations` – database schema
