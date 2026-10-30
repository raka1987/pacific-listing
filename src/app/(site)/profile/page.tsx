import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, KeyRound } from "lucide-react";
import { DeleteAccount } from "@/components/delete-account";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { ProfileForm } from "./form";

export const metadata: Metadata = { title: "Your profile", robots: { index: false } };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ password?: string }> }) {
  const { user, profile } = await requireUser("/profile");
  const { password } = await searchParams;
  if (!profile) return null;
  return (
    <div className="container-page max-w-3xl py-8">
      <PageHeader
        title="Your profile"
        description="Buyers see your name and photo on your ads."
        action={
          <Link href={`/seller/${user.id}`} className="btn-secondary">
            <ExternalLink className="h-4 w-4" /> View public page
          </Link>
        }
      />
      {password === "updated" && <p className="mb-4 rounded-xl bg-lagoon-50 p-3 text-sm text-lagoon-800">Your password has been changed.</p>}
      <ProfileForm profile={profile} email={user.email ?? ""} />
      <div className="card mt-6 flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h2 className="font-bold text-ink">Password</h2>
          <p className="text-sm text-muted">Change the password you use to log in.</p>
        </div>
        <Link href="/update-password" className="btn-secondary">
          <KeyRound className="h-4 w-4" /> Change password
        </Link>
      </div>
      <DeleteAccount />
    </div>
  );
}
