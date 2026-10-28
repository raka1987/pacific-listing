import type { Metadata } from "next";
import { AuthCard, AuthLink } from "@/components/auth-card";
import { SignupForm } from "./form";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next = "/" } = await searchParams;
  return (
    <AuthCard
      title="Create your free account"
      subtitle="Join buyers and sellers across the Pacific."
      footer={<>Already have an account? <AuthLink href={`/login?next=${encodeURIComponent(next)}`}>Log in</AuthLink></>}
    >
      <SignupForm next={next} />
    </AuthCard>
  );
}
