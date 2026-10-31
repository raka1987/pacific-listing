import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Delete your account",
  description: "How to delete your Pacific Listing account and the data linked to it.",
  alternates: { canonical: "/delete-account" },
};

export default function DeleteAccountInfoPage() {
  return (
    <ContentPage title="Delete your account" intro="How to delete your Pacific Listing account and the information linked to it.">
      <div className="prose-simple">
        <h2>Delete it yourself (website or app)</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Log in to Pacific Listing on the website or in the Pacific Listing app.</li>
          <li>Go to <strong>Account → Profile</strong>.</li>
          <li>Scroll to the bottom and tap <strong>Delete my account</strong>.</li>
          <li>Type <strong>DELETE</strong> to confirm. Your account is deleted straight away.</li>
        </ol>
        <p>
          <Link href="/login?next=/profile" className="btn-primary mt-2 inline-flex text-white no-underline">Log in to delete my account</Link>
        </p>

        <h2>Can&apos;t log in?</h2>
        <p>
          Email <a href={`mailto:${SITE.supportEmail}?subject=Delete my account`}>{SITE.supportEmail}</a> from the email address on
          your account, with the subject &ldquo;Delete my account&rdquo;. We&apos;ll delete it within 7 days and reply to confirm.
        </p>

        <h2>What is deleted</h2>
        <ul>
          <li>Your login, name, email, phone and WhatsApp numbers, country and profile photo</li>
          <li>All your ads and their photos</li>
          <li>Your saved ads</li>
          <li>Your chats and the messages in them</li>
        </ul>

        <h2>What we keep</h2>
        <ul>
          <li>
            Records of payments you made for promotions or plans, kept for our accounts and tax records. They are no longer linked to
            your name or login.
          </li>
          <li>Reports you sent about ads or chats, kept without your name so our safety team can still act on them.</li>
          <li>Messages you sent us through the contact form or by email, as with any email.</li>
        </ul>
        <p>
          Deleting your account can&apos;t be undone. Read our <Link href="/privacy">privacy policy</Link> for more about how we handle
          your information.
        </p>
      </div>
    </ContentPage>
  );
}
