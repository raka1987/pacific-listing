# Pacific Listing: launch marketing plan

**Goal for the first 90 days:** fill the site with real ads, then bring buyers to them.
Buyers come for listings and sellers come for buyers, so start with **sellers**.

Images for everything below are in `marketing/images/`:
`post-1…6` (square, Facebook/Instagram), `story-1…2` (WhatsApp Status, Instagram/Facebook Stories),
`facebook-cover.png`, `profile-picture.png`.

---

## Week 1: switch things on (about 1 hour)

1. **Run the new database update.** In Supabase, go to **SQL Editor → New query**, paste the whole of
   `supabase/migrations/20261103000000_marketing.sql`, and click **Run**. This turns on the launch offer and
   the "How did you hear about us?" question.
2. **Turn on the launch offer.** Go to **Admin → Settings → Launch offer: first ad featured free**, set `7`,
   and click **Save settings**. Each new seller's first ad then goes on the homepage for a week.
3. **Google Search Console** (free; gets you on Google):
   1. Go to search.google.com/search-console, click **Add property**, and choose **Domain**:
      `pacificlisting.com`.
   2. Google gives you a **TXT record**. In **Namecheap → Advanced DNS → Add new record**, choose
      **TXT**, Host `@`, paste the value, and save. Click **Verify** (it can take up to an hour).
   3. Go to **Sitemaps** and submit `https://www.pacificlisting.com/sitemap.xml`.
4. **Bing Webmaster Tools** (bing.com/webmasters): sign in and choose **Import from Google Search
   Console**. Bing's results feed ChatGPT search and Microsoft Copilot.
5. **Facebook Page** for Pacific Listing: use `profile-picture.png` and `facebook-cover.png`, add the
   website and support@pacificlisting.com, and connect **Instagram** in Meta Business Suite.
6. **Measurement** (needed before paying for ads):
   - **Google Analytics:** create a GA4 property for the website and copy the **Measurement ID**
     (`G-…`).
   - **Meta Pixel:** in Meta Events Manager, create a **Pixel** for the website and copy the **Pixel ID**
     (numbers only).
   - In **Vercel → Settings → Environment Variables**, add `GA_MEASUREMENT_ID` and `META_PIXEL_ID`, then
     **Redeploy**. A cookie notice appears on the site, and tracking only starts for visitors who accept.
     The phone apps never track.

---

## Weeks 1–4: fill the site with sellers

### A. Businesses first (the fastest way to get many good ads)
Make a list of 30–50 businesses per country: **car yards, real estate agents, furniture and
appliance shops, boat dealers, tradespeople, recruitment agencies**. Start in Suva, Nadi, Lautoka,
Apia, Nuku'alofa and Port Vila.

**Offer:** 3 months of **Business Pro free**. In the admin panel, open their user page, then **Business
account → Give business account**, and choose 90 days. In return, they list their stock.

**Message to send** (WhatsApp, Facebook message or email):
> Bula / Talofa / Mālō e lelei [name]! I'm [your name] from Pacific Listing (pacificlisting.com), the new
> free marketplace for the Pacific. We're inviting a few [car yards / agents / shops] in [town] to list their
> stock before we start advertising to buyers. You'd get a free Business account for 3 months: your
> business name and badge on every ad, unlimited listings and free bumps to the top. If you send us your
> stock list, we can even help upload it. Could I set you up this week?

### B. Your own network
- Ask 20 friends and family to each **list 2–3 real things** they want to sell or rent out.
- Post `post-1-list-free.png` on your personal Facebook and WhatsApp Status (`story-1-list-free.png`).

### C. Facebook groups (where Pacific buying and selling already happens)
- Join the main buy/sell groups in each country and town, and **read each group's rules first**.
  Many don't allow links or business posts, so ask the admin.
- When someone sells something in a group, invite them to list it on Pacific Listing too: it stays
  searchable and doesn't get buried.
- After posting an ad, sellers now see **Share to WhatsApp / Facebook** buttons. The share card shows the
  ad's photo and details automatically.

**Group post template** (where allowed):
> 📢 Selling something? You can now list it **free** on Pacific Listing. It's a marketplace just for the
> Pacific, with photos, prices in [FJD/WST/TOP/VUV], and buyers who contact you on WhatsApp. Ads stay
> up and searchable, so they don't get lost in the feed. 👉 pacificlisting.com/sell

### D. Ready-to-post Facebook / Instagram captions
1. *(post-1)* Got something sitting around you don't use? List it free on Pacific Listing in about a minute.
   Buyers call or WhatsApp you directly. 👉 pacificlisting.com/sell
2. *(post-2)* Selling your ute, SUV or car? Add a few photos, set your town, and buyers across the islands can
   find it. Free to post. 👉 pacificlisting.com/sell
3. *(post-3)* Room for rent? Land to lease? House for sale? Put it where people are looking.
   👉 pacificlisting.com/sell
4. *(post-4)* Car yards, agents and shops: put your whole stock online with a Pacific Listing Business
   account. Your logo, more ads and free bumps every month. 👉 pacificlisting.com/business
5. *(post-5)* Hiring? Offering cleaning, building, tutoring or catering? Post it free and get found by
   locals. 👉 pacificlisting.com/sell
6. *(post-6)* Made for the islands 🌊 Fiji, Samoa, Tonga, Vanuatu, the Solomon Islands, PNG and more. Local
   currency, local towns, local people. 👉 pacificlisting.com

**Hashtags:** #Fiji #Samoa #Tonga #Vanuatu #SolomonIslands #PNG #Pacific #BuyAndSell #Suva #Nadi #Apia #Nukualofa #PortVila

**Rules for marketing:** only show real prices from real ads, never invent listings, and get the
seller's okay before featuring their ad in a post.

---

## Weeks 3–8: paid ads (start small)

Turn these on **after the site has real ads** and the Pixel is set up. Start at about FJD 10–20 a day per
country, and move money to what brings sign-ups and posted ads.

### Meta (Facebook and Instagram): the strongest channel in the Pacific
| Campaign | Goal | Who to show it to | Send people to | Images |
|---|---|---|---|---|
| **Sellers** | Leads / Traffic | 18–60, one country per ad set (Fiji, Samoa, Tonga, Vanuatu…), interests: buying and selling, Facebook Marketplace, cars, real estate, small business | `pacificlisting.com/sell` | post-1, post-2, post-3, story-1, story-2 |
| **Businesses** | Leads | 25–60, business page admins, interests: car dealerships, real estate, retail | `pacificlisting.com/business` | post-4 |
| **Buyers** (once a country has 100+ ads) | Traffic | 18–60 in that country, interests matching the category | the country page, e.g. `pacificlisting.com/fiji/vehicles` | post-6, plus real ads (with permission) |
| **Retargeting** | Conversions | People who visited the site in the last 30 days (Pixel audience) | `pacificlisting.com/sell` | post-1 |

Tip: Pacific diaspora in **New Zealand and Australia** often shop for family back home. Try a small
ad set there for the buyer campaign.

### Google Ads (search): people already looking
Send each keyword group to its matching country page:
- `cars for sale fiji`, `used cars suva`, `utes for sale fiji` → `/fiji/vehicles`
- `house for rent suva`, `rent fiji`, `land for sale fiji` → `/fiji/property/for-rent` or `/fiji/property/land-sale`
- `jobs in fiji`, `vacancies suva` → `/fiji/jobs`
- The same for Samoa (`/samoa/...`), Tonga (`/tonga/...`), Vanuatu (`/vanuatu/...`)
- Negative keywords: `free`, `scam`, `login`, `facebook`

### TikTok
Short videos, such as "Deal of the day in Suva" (with the seller's permission and the real price),
"How to list your car in 60 seconds", or behind the scenes with a local car yard.

---

## Getting found on Google and AI assistants (already built into the site)
- **Landing pages for every country, category, type and main town.** For example
  pacificlisting.com/fiji/vehicles/utes, /samoa/property/for-rent and /fiji/suva. Each has its own title,
  description, FAQs and links, and is listed in the sitemap.
- **Share cards:** every ad shows its photo, price, title and location when shared on Facebook or WhatsApp.
- **AI assistants:** `pacificlisting.com/llms.txt` explains the site to ChatGPT, Perplexity and others,
  and the homepage has structured data for Google.
- **What helps most from here:** more real ads (each one is a new page Google can show), and links from
  other sites, such as local news stories about the launch, business directories, and partners' websites
  linking to their Pacific Listing shop page.

---

## What to watch each week
| Number | Where |
|---|---|
| New sign-ups and **where they heard about us** | Admin → Dashboard |
| New ads per day, by category | Admin → Dashboard |
| Searches and pages people find you through | Google Search Console → Performance |
| Visitors, sign-ups and ads posted from ads | Google Analytics, Meta Events Manager |
| Cost per sign-up and per posted ad | Meta Ads Manager / Google Ads |

**Milestones to aim for:** 100 live ads in Fiji → 500 → 1,000. Then repeat country by country.
