import type { Metadata } from "next";
import Link from "next/link";
import { BellOff } from "lucide-react";
import { AuthCard } from "@/components/auth-card";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };

const WHAT: Record<string, string> = {
  chat: "chat message emails",
  alerts: "saved search and price drop emails",
  all: "all Pacific Listing emails except account and security emails",
};

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ t?: string; k?: string }> }) {
  const { t = "", k = "all" } = await searchParams;
  const kind = WHAT[k] ? k : "all";
  let ok = false;
  if (/^[0-9a-f-]{36}$/i.test(t)) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("unsubscribe", { p_token: t, p_kind: kind });
    ok = data === true;
  }
  return (
    <AuthCard title={ok ? "You're unsubscribed" : "Link not recognised"}>
      <div className="text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-lagoon-50 text-lagoon-600">
          <BellOff className="h-7 w-7" />
        </span>
        <p className="mt-4 text-sm text-ink-2">
          {ok
            ? `We won't send you ${WHAT[kind]} any more.`
            : "This unsubscribe link didn't work. You can turn emails on or off in your profile instead."}
        </p>
        <Link href="/profile" className="btn-secondary mt-5 w-full">Change email settings</Link>
      </div>
    </AuthCard>
  );
}
