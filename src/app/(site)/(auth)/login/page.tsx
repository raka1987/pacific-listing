import type { Metadata } from "next";
import { AuthCard, AuthLink } from "@/components/auth-card";
import { LoginForm } from "./form";

export const metadata: Metadata = { title: "Log in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; confirmed?: string }> }) {
  const { next = "/", error, confirmed } = await searchParams;
  return (
    <AuthCard
      title="Welcome back"
      subtitle="Log in to post ads, save favourites and manage your listings."
      footer={<>New to Pacific Listing? <AuthLink href={`/signup?next=${encodeURIComponent(next)}`}>Create a free account</AuthLink></>}
    >
      {error === "link" && (
        <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          That link has expired or was already used. If you&apos;ve clicked it before, your email is already confirmed, so just log in
          below. If not, log in and we&apos;ll offer to send a new link.
        </p>
      )}
      {confirmed && (
        <p className="mb-4 rounded-xl bg-lagoon-50 p-3 text-sm text-lagoon-800">
          <strong>Your email is confirmed.</strong> Log in below to start using your account.
        </p>
      )}
      <LoginForm next={next} />
    </AuthCard>
  );
}
