# Pacific Listing phone apps: getting into Google Play and the App Store

The apps open **pacificlisting.com** inside a native app (built with Capacitor), so every website
update reaches the apps straight away. You only publish a new app version when the app shell itself
changes, for example a new icon or new phone features.

You don't need a Mac: **Codemagic** builds both apps in the cloud from this GitHub repository.

| What's in the repository | What it is |
|---|---|
| `capacitor.config.ts` | App name, ID (`com.pacificlisting.app`), the website it opens, splash screen |
| `android/` | The Android app project |
| `ios/` | The iPhone app project (iPhone only, no iPad) |
| `mobile/` | Two small pages bundled in the app: start-up and "You're offline" |
| `assets/` | Source images for the app icon and splash screen |
| `codemagic.yaml` | Cloud build recipes |
| `store/` | Screenshots, feature graphic, icon and all the listing text (`store/listing.md`) |

---

## Part 1: Android (Google Play). Do this first

### 1. Create your Google Play developer account (US$25, once)
1. Go to **play.google.com/console** and sign up with your Google account, choosing **Individual**.
2. Pay the US$25 fee and complete identity verification (photo ID). This can take a few days.
3. Verify a phone number and email address when asked.

> **Testing rule for new personal accounts:** before your app can go public, Google requires a
> **closed test with at least 12 testers who stay opted in for 14 days in a row**. Line up 12
> friends, family or customers with Android phones (they just need a Gmail address). The steps are below.

### 2. Set up Codemagic (free plan is enough)
1. Go to **codemagic.io**, choose **Sign up with GitHub**, and allow access to the
   **raka1987/pacific-listing** repository.
2. Click **Add application**, choose the repository, and select **codemagic.yaml** as the configuration.
3. Add your Android upload key: **Team settings → codemagic.yaml settings → Code signing identities →
   Android keystores → Add keystore**.
   - Upload `pacific-listing-upload.jks`.
   - Enter the passwords and alias from the "KEEP SAFE" note that came with it.
   - **Reference name:** `pacific_listing_upload` (exactly).

### 3. Build the first Android version
1. In Codemagic, open the app, click **Start new build**, and choose **Android - build only**.
2. After about 10 minutes, download the **`.aab`** file from the build's **Artifacts**.

### 4. Create the app in Google Play Console
1. Click **Create app**. Name: `Pacific Listing`; App; Free.
2. Under **Grow → Store presence → Main store listing**, paste the texts from `store/listing.md` and upload:
   - App icon: `store/play-icon-512.png`
   - Feature graphic: `store/feature-graphic.png`
   - Phone screenshots: all 5 files in `store/screenshots/android/`
3. Under **Policy → App content**, complete each section using `store/listing.md`:
   - Privacy policy: `https://pacificlisting.com/privacy`
   - **Ads:** Yes, the app contains ads.
   - App access: give the reviewer login (see "Reviewer account" below).
   - Content rating, target audience (18+ or 13+; not for children), data safety and **data deletion**
     (the URL is `https://pacificlisting.com/profile`).

### 5. Closed test (the 14-day rule)
1. Go to **Test and release → Testing → Closed testing → Create track**.
2. **Testers:** create an email list with your 12+ testers.
3. **Create release:** upload the `.aab`. Release name: `1.0.0`. Notes: `First version`. Then roll out.
4. Send testers the **opt-in link** shown on that page. They accept, then install from Google Play.
5. After 14 days with 12+ testers, go to **Dashboard → Apply for production**. Once approved, create a
   **Production** release with the same or a newer `.aab`.

> For a quick look before the closed test, use **Internal testing** (up to 100 people, no review)
> with the same `.aab`.

### 6. Later Android updates (automatic upload)
1. Create a Google Cloud **service account** with access to Play Console. Codemagic's guide:
   https://docs.codemagic.io/yaml-publishing/google-play/
2. In Codemagic, go to **Team settings → Global variables and secrets**, create a group named
   **`google_play`**, and add the variable `GCLOUD_SERVICE_ACCOUNT_CREDENTIALS` with the JSON key
   contents (mark it Secure).
3. Use the **Android - build and send to Google Play** workflow. It uploads a draft to Internal testing.

---

## Part 2: iPhone (App Store)

### 1. Join the Apple Developer Program (US$99 a year)
1. On an iPhone, install the **Apple Developer** app, sign in with your Apple ID (two-factor
   authentication must be on), and choose **Enroll Now → Individual**. Or use developer.apple.com/programs.
2. Approval usually takes up to 48 hours. As an individual, the App Store shows **your name** as the seller.

### 2. Register the app's ID
1. Go to **developer.apple.com → Account → Certificates, IDs & Profiles → Identifiers → +**.
2. Choose **App IDs → App**.
   - Description: `Pacific Listing`
   - Bundle ID: **Explicit**, `com.pacificlisting.app`
3. Click **Continue → Register**.

### 3. Create the app in App Store Connect
1. Go to **appstoreconnect.apple.com → Apps → + → New App**:
   - Platform: iOS
   - Name: `Pacific Listing`
   - Language: English (U.K.) or (U.S.)
   - Bundle ID: `com.pacificlisting.app`
   - SKU: `pacificlisting`
2. Open **App Information** and copy the **Apple ID** number (about 10 digits). Send it to your
   developer (or Claude), who puts it in `codemagic.yaml` as `APP_STORE_APPLE_ID`.

### 4. Connect Codemagic to Apple
1. In App Store Connect, go to **Users and Access → Integrations → App Store Connect API → +**.
   Name it `Codemagic` with access **App Manager**, then click **Generate**.
2. **Download the .p8 key file** (Apple only lets you download it once). Note the **Key ID** and **Issuer ID**.
3. In Codemagic, go to **Team settings → Team integrations → Developer Portal → Connect**, upload the
   .p8, enter the Key ID and Issuer ID, and name it **`Pacific Listing`** (exactly).
4. In Codemagic, go to **Team settings → codemagic.yaml settings → Code signing identities →
   iOS certificates → Generate certificate**. Choose the key above and type **Apple Distribution**.
   Then on the **iOS provisioning profiles** tab, click **Fetch profiles** and fetch the App Store
   profile for `com.pacificlisting.app` (create it if offered).

### 5. Build and test on your iPhone (TestFlight)
1. In Codemagic, click **Start new build → iPhone - build and send to TestFlight**.
2. About 20 minutes later the build appears in App Store Connect under **TestFlight**. Apple processes
   it, which takes up to an hour.
3. Install **TestFlight** from the App Store on your iPhone, add yourself as an internal tester, and install Pacific Listing.

### 6. Submit for review
1. In App Store Connect, open the app, then the **iOS app 1.0** page:
   - Screenshots (6.9" or 6.7" display): all 5 files in `store/screenshots/iphone/`
   - Promotional text, description, keywords, support and marketing URLs: from `store/listing.md`
   - **Build:** choose the TestFlight build
   - **App Review Information:** the reviewer login and notes from `store/listing.md`
2. Complete **App Privacy** using the data table in `store/listing.md`, plus **Age Rating** and **Pricing (Free)**.
3. Click **Add for Review → Submit**. Reviews usually take 1–3 days.

---

## Reviewer account (both stores)
Reviewers need a working login.
1. On pacificlisting.com, sign up with an email you control, for example `appreview@pacificlisting.com`
   using your email forwarding, and a strong password.
2. Post one example ad from it so reviewers can see "My ads".
3. Put the email and password in Play Console (**App access**) and App Store Connect (**App Review Information**).

## Payments inside the apps
Apple and Google require their own in-app purchase systems for digital extras bought inside an app.
So inside the apps, the **Promote** buttons, **Business plans** sign-up, **Payments** pages and
"Advertise with us" links are hidden. People buy those on the website, which is unchanged.

**Posting fees:** if a category has a posting fee, app users can still post, but the ad waits as
"Awaiting payment" with no way to pay inside the app. Before launching the apps, either
**switch posting fees off** (Admin → Promotions & fees) or plan to add in-app purchases later.

## Costs
| Item | Cost |
|---|---|
| Google Play developer account | US$25 once |
| Apple Developer Program | US$99 per year |
| Codemagic | Free plan (500 Mac build minutes a month; all builds use Mac machines, enough for several releases) |

## If Apple rejects the app
Apple sometimes rejects apps that mostly show a website ("guideline 4.2"). The usual fix is adding
more phone features, such as **push notifications** ("Your ad is live", "Payment confirmed") and a native share button. Reply to the
reviewer, and ask your developer to add these. The app project is ready for them.

---

## Phone notifications (push)

New chat messages are sent to people's phones through Firebase (free).

1. **Firebase project:** console.firebase.google.com → **Add project** → name it `Pacific Listing`
   (Google Analytics can be off).
2. **Android:** in the project, click the **Android** icon → package name `com.pacificlisting.app` →
   **Register app** → **Download google-services.json**. Put it in the repository at
   `android/app/google-services.json` (the Codemagic build stops if it's missing).
3. **Sending key:** Firebase → ⚙️ **Project settings → Service accounts → Generate new private key**.
   In **Vercel → Settings → Environment Variables**, add `FIREBASE_SERVICE_ACCOUNT` with the whole
   contents of that file, and `PUSH_SECRET` with a long random password. Redeploy.
4. **Database settings** (Supabase → SQL Editor), using the same `PUSH_SECRET`:
   ```sql
   select vault.create_secret('https://www.pacificlisting.com/api/push', 'push_url');
   select vault.create_secret('YOUR_PUSH_SECRET', 'push_secret');
   ```
5. Build a new app version in Codemagic and upload it to Google Play.
6. **iPhone (later):** Apple Developer → Keys → new key with **Apple Push Notifications service (APNs)**,
   upload it in Firebase → Project settings → Cloud Messaging → Apple app configuration, and add the
   iPhone app (`com.pacificlisting.app`) to the Firebase project.
