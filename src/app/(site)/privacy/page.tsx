import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <ContentPage title="Privacy policy" intro="Last updated: October 2026">
      <div className="prose-simple">
        <p>This policy explains what information Pacific Listing collects, why, and the choices you have.</p>
        <h2>What we collect</h2>
        <ul>
          <li><strong>Account details</strong> — your name, email, and optionally your phone, WhatsApp number, country and photo.</li>
          <li><strong>Ads you post</strong> — text, photos, price, location and the contact numbers you choose to show.</li>
          <li><strong>Usage</strong> — basic information such as ad views and saved ads, so the site works and we can improve it.</li>
          <li><strong>Messages</strong> — anything you send us through the contact or report forms.</li>
        </ul>
        <h2>How we use it</h2>
        <ul>
          <li>To run your account and show your ads to buyers.</li>
          <li>To keep the site safe — reviewing reports and stopping scams and spam.</li>
          <li>To reply to you and send important account emails (like password resets).</li>
        </ul>
        <h2>What&apos;s public</h2>
        <p>
          Your name, profile photo, and the phone/WhatsApp numbers you add to ads are visible to people viewing your ads. Your
          email address is never shown publicly.
        </p>
        <h2>Cookies and analytics</h2>
        <p>
          We use essential cookies to keep you logged in and remember your country and settings. If you accept our cookie notice, we also use Google
          Analytics to understand how the site is used, and the Meta (Facebook) Pixel to measure and show our ads to people who may be interested in
          Pacific Listing. You can choose &quot;No thanks&quot; and the site works the same. The phone apps don&apos;t use these tools.
        </p>
        <h2>Sharing</h2>
        <p>
          We don&apos;t sell your personal information. We use trusted service providers to host the site and store data, and
          we may share information if required by law or to prevent fraud.
        </p>
        <h2>Your choices</h2>
        <ul>
          <li>You can edit your profile and ads, or delete your ads, at any time.</li>
          <li>You can delete your account at any time from <strong>Profile → Delete account</strong>, in the app or on the website. This removes your login, profile, ads and photos.</li>
        </ul>
        <h2>Contact</h2>
        <p>
          For privacy questions, email <a href={`mailto:${SITE.supportEmail}`} className="text-lagoon-700 underline">{SITE.supportEmail}</a>.
        </p>
      </div>
    </ContentPage>
  );
}
