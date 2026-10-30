import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export const metadata: Metadata = { title: "Account deleted", robots: { index: false } };

export default function AccountDeletedPage() {
  return (
    <div className="container-page flex flex-col items-center py-24 text-center">
      <CheckCircle2 className="h-12 w-12 text-lagoon-600" />
      <h1 className="font-display mt-4 text-3xl font-semibold">Your account has been deleted</h1>
      <p className="mt-2 max-w-md text-muted">Your profile, ads and photos have been removed. Thanks for using Pacific Listing.</p>
      <Link href="/" className="btn-primary mt-6">
        Back to Pacific Listing
      </Link>
    </div>
  );
}
