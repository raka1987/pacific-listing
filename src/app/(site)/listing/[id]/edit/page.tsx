import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { updateListing } from "@/app/actions";
import { ListingForm } from "@/components/listing-form";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Listing } from "@/lib/types";

export const metadata: Metadata = { title: "Edit ad", robots: { index: false } };

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, profile } = await requireUser(`/listing/${id}/edit`);
  const supabase = await createClient();
  const { data: listing } = await supabase.from("listings").select("*").eq("id", id).maybeSingle<Listing>();
  if (!listing || (listing.user_id !== user.id && profile?.role !== "admin")) notFound();

  return (
    <div className="container-page max-w-3xl py-8">
      <PageHeader title="Edit your ad" />
      <ListingForm
        action={updateListing.bind(null, listing.id)}
        userId={user.id}
        listing={listing}
        defaults={{ country: null, city: null, phone: null, whatsapp: null }}
      />
    </div>
  );
}
