import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, ExternalLink, KeyRound } from "lucide-react";
import { DeleteAccount } from "@/components/delete-account";
import { EmailSettings } from "@/components/email-settings";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./form";

export const metadata: Metadata = { title: "Your profile", robots: { index: false } };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ password?: string }> }) {
  const { user, profile } = await requireUser("/profile");
  const { password } = await searchParams;
  if (!profile) return null;
  const supabase = await createClient();
  const { data: prefs } = await supabase.rpc("get_my_notify_prefs");
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
          <h2 className="flex items-center gap-2 font-bold text-ink">
            <BadgeCheck className="h-4 w-4 text-lagoon-600" /> {profile.is_verified ? "You're a verified seller" : "Get verified"}
          </h2>
          <p className="text-sm text-muted">
            {profile.is_verified ? "Your ads and profile show the verified tick." : "Show buyers you're genuine with a verified tick on your ads."}
          </p>
        </div>
        {!profile.is_verified && <Link href="/verify" className="btn-secondary">Get verified</Link>}
      </div>
      {prefs && <EmailSettings initial={prefs as { chat: boolean; alerts: boolean }} />}
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
