import type { Metadata } from "next";
import { createListing } from "@/app/actions";
import { ListingForm } from "@/components/listing-form";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Post a free ad", robots: { index: false } };

export default async function PostPage() {
  const { user, profile } = await requireUser("/post");
  if (profile?.is_banned) {
    return (
      <div className="container-page max-w-3xl py-10">
        <PageHeader title="Account suspended" description="Your account can't post new ads. Contact support if you think this is a mistake." />
      </div>
    );
  }
  return (
    <div className="container-page max-w-3xl py-8">
      <PageHeader title="Post a free ad" description="It only takes a minute. Fill in the details below." />
      <ListingForm
        action={createListing}
        userId={user.id}
        defaults={{
          country: profile?.country ?? null,
          city: profile?.city ?? null,
          phone: profile?.phone ?? null,
          whatsapp: profile?.whatsapp ?? null,
        }}
      />
    </div>
  );
}
