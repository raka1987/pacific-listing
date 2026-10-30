import { ChatWatcher } from "@/components/chat-unread";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { InstallBanner } from "@/components/install-app";
import { MobileNav } from "@/components/mobile-nav";
import { NativeApp } from "@/components/native-app";
import { RegisterServiceWorker } from "@/components/register-sw";
import { getAuthUser } from "@/lib/auth";
import { getUnreadChats } from "@/lib/chat";
import { createClient } from "@/lib/supabase/server";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const [{ data: settings }, user, unread] = await Promise.all([
    supabase.from("site_settings").select("announcement").eq("id", 1).maybeSingle(),
    getAuthUser(),
    getUnreadChats(),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      {settings?.announcement && (
        <div className="bg-gradient-to-r from-lagoon-700 to-ocean-800 px-4 py-2 text-center text-sm font-medium text-white">{settings.announcement}</div>
      )}
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <MobileNav unread={unread} />
      {user && <ChatWatcher userId={user.id} />}
      <InstallBanner />
      <RegisterServiceWorker />
      <NativeApp />
    </div>
  );
}
