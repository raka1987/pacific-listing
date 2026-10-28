import type { Metadata } from "next";
import { AuthCard, AuthLink } from "@/components/auth-card";
import { LoginForm } from "./form";

export const metadata: Metadata = { title: "Log in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next = "/", error } = await searchParams;
  return (
    <AuthCard
      title="Welcome back"
      subtitle="Log in to post ads, save favourites and manage your listings."
      footer={<>New to Pacific Listing? <AuthLink href={`/signup?next=${encodeURIComponent(next)}`}>Create a free account</AuthLink></>}
    >
      {error === "link" && (
        <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">That link has expired or was already used. Please log in or request a new one.</p>
      )}
      <LoginForm next={next} />
    </AuthCard>
  );
}
