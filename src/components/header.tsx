import Link from "next/link";
import { Suspense } from "react";
import { Heart, Plus } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getViewer, VIEWER_REGIONS } from "@/lib/location";
import { CountryPicker } from "./country-picker";
import { Logo } from "./logo";
import { SearchBar } from "./search-bar";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

export async function Header() {
  const current = await getCurrentUser();
  const profile = current?.profile;
  const viewer = await getViewer();

  return (
    <header className="glass sticky top-0 z-40 border-b border-line pt-[env(safe-area-inset-top)]">
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
            <Link
              href="/favorites"
              className="hidden h-10 w-10 items-center justify-center rounded-full text-ink-2 transition hover:bg-subtle hover:text-ink sm:flex"
              aria-label="Saved ads"
            >
              <Heart className="h-[18px] w-[18px]" />
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
            <Plus className="h-4 w-4" strokeWidth={2.5} /> Sell
          </Link>
        </nav>
      </div>
    </header>
  );
}
