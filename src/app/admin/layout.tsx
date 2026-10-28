import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/logo";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminNav } from "./nav";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin | Pacific Listing" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireAdmin();
  const supabase = await createClient();
  const [pending, reports, messages] = await Promise.all([
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("contact_messages").select("id", { count: "exact", head: true }).eq("status", "new"),
  ]);

  return (
    <div className="min-h-screen bg-subtle lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="bg-ocean-950 p-4 lg:sticky lg:top-0 lg:h-screen lg:p-5">
        <div className="mb-4 flex items-center justify-between lg:mb-8 lg:block">
          <Logo light />
          <span className="badge bg-coral-500 text-white lg:mt-3">Admin</span>
        </div>
        <AdminNav counts={{ pending: pending.count ?? 0, reports: reports.count ?? 0, messages: messages.count ?? 0 }} />
        <div className="mt-8 hidden border-t border-white/10 pt-5 lg:block">
          <p className="truncate text-sm font-medium text-white">{profile?.full_name}</p>
          <Link href="/" className="mt-2 flex items-center gap-1.5 text-sm text-faint hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back to site
          </Link>
        </div>
      </aside>
      <main className="min-w-0 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
