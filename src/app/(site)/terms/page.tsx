import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = { title: "Terms of service" };

export default function TermsPage() {
  return (
    <ContentPage title="Terms of service" intro="Last updated: October 2026">
      <div className="prose-simple">
        <p>
          These terms apply when you use Pacific Listing (&quot;we&quot;, &quot;us&quot;). By creating an account or posting an ad, you
          agree to them. If you don&apos;t agree, please don&apos;t use the site.
        </p>
        <h2>1. What we do</h2>
        <p>
          Pacific Listing is an online noticeboard where people post classified ads. We are not a party to any sale, and we
          don&apos;t own, inspect, or guarantee any item, property, job or service listed. Any deal is strictly between the buyer
          and seller.
        </p>
        <h2>2. Your account</h2>
        <ul>
          <li>You must give accurate information and keep your password safe.</li>
          <li>You&apos;re responsible for everything posted from your account.</li>
          <li>You must be old enough to enter a binding contract in your country.</li>
        </ul>
        <h2>3. Posting rules</h2>
        <p>You must not post ads that:</p>
        <ul>
          <li>are illegal where you or the buyer live, including weapons, drugs, stolen goods or protected wildlife;</li>
          <li>are misleading, fraudulent, or for items you don&apos;t have the right to sell;</li>
          <li>contain offensive, hateful or adult content, or someone else&apos;s personal information;</li>
          <li>are duplicates, spam, or posted in the wrong category.</li>
        </ul>
        <p>We may edit, hide or remove any ad, and suspend any account, at our discretion — especially to protect other users.</p>
        <h2>4. Your content</h2>
        <p>
          You keep ownership of the photos and text you post. You give us permission to display, resize and share them on
          Pacific Listing and to promote your ad.
        </p>
        <h2>5. Safety</h2>
        <p>
          Please follow our <Link href="/safety" className="text-lagoon-700 underline">safety tips</Link>. We are not responsible for losses
          from dealing with other users, but we will act on reports of scams or abuse.
        </p>
        <h2>6. Liability</h2>
        <p>
          The site is provided &quot;as is&quot;. To the extent allowed by law, we are not liable for indirect losses or for the
          actions of other users.
        </p>
        <h2>7. Changes</h2>
        <p>We may update these terms. If changes are significant we&apos;ll let you know on the site.</p>
        <h2>8. Contact</h2>
        <p>
          Questions? Email <a href={`mailto:${SITE.supportEmail}`} className="text-lagoon-700 underline">{SITE.supportEmail}</a> or use our{" "}
          <Link href="/contact" className="text-lagoon-700 underline">contact form</Link>.
        </p>
      </div>
    </ContentPage>
  );
}
