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
2. When it's ready, open **SQL Editor**, then **New query**. Paste the whole contents of
   `supabase/migrations/20261028000000_init.sql` and click **Run**. This creates all tables, security rules and photo storage.
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
`SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-demo.mjs <folder-of-jpgs>`.
The script needs these photo filenames: see `LISTINGS[].photos`.

**Security model:** every table uses Postgres row-level security. Users can only change their own ads and profile. Triggers stop users from featuring their own ads, approving themselves, or making themselves admin. Profile emails can't be read through the public API. Admin actions are checked both in the server code and in the database.

**Structure**
- `src/app/(site)` – public pages (home, search, category, listing, post/edit, account, info pages)
- `src/app/admin` – admin panel
- `src/app/actions.ts`, `src/app/admin/actions.ts` – server actions (all writes)
- `src/lib/constants.ts` – categories, countries/currencies, site name. Edit here to add a category or country.
- `supabase/migrations` – database schema
