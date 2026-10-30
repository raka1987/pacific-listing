import Link from "next/link";
import { Suspense } from "react";
import { MessagesSquare, Plus } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getUnreadChats } from "@/lib/chat";
import { getViewer, VIEWER_REGIONS } from "@/lib/location";
import { UnreadBadge } from "./chat-unread";
import { CountryPicker } from "./country-picker";
import { Logo } from "./logo";
import { SearchBar } from "./search-bar";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

export async function Header() {
  const current = await getCurrentUser();
  const profile = current?.profile;
  const [viewer, unread] = await Promise.all([getViewer(), getUnreadChats()]);

  return (
    <header className="glass sticky top-0 z-40 border-b border-line pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="container-page flex h-16 items-center gap-3 sm:gap-5">
        <Logo />
        <div className="hidden max-w-xl flex-1 md:block">
          <Suspense>
            <SearchBar />
          </Suspense>
        </div>
        <nav className="ml-auto flex items-center gap-1 sm:gap-1.5">
          <Link href="/search" className="btn-ghost hidden px-4 lg:inline-flex">
            Browse
          </Link>
          <CountryPicker regions={VIEWER_REGIONS} current={{ code: viewer.country, flag: viewer.flag, currency: viewer.currency }} />
          <ThemeToggle />
          {current && (
            <Link href="/messages" className="relative hidden h-10 w-10 items-center justify-center rounded-full text-ink-2 hover:bg-subtle sm:flex" aria-label="Messages">
              <MessagesSquare className="h-5 w-5" />
              <UnreadBadge initial={unread} className="absolute -top-0.5 -right-0.5" />
            </Link>
          )}
          {current ? (
            <UserMenu
              name={profile?.full_name || current.user.email || "Account"}
              avatarUrl={profile?.avatar_url ?? null}
              isAdmin={!!profile && profile.role !== "user"}
            />
          ) : (
            <Link href="/login" className="btn-ghost px-4">
              Log in
            </Link>
          )}
          <Link href="/post" className="btn-accent ml-1 hidden sm:inline-flex">
            <Plus className="h-4 w-4" strokeWidth={2.5} /> List
          </Link>
        </nav>
      </div>
    </header>
  );
}
