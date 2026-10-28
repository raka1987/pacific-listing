import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { Logo } from "./logo";
import { SearchBar } from "./search-bar";
import { UserMenu } from "./user-menu";

export async function Header() {
  const current = await getCurrentUser();
  const profile = current?.profile;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 backdrop-blur-md">
      <div className="container-page flex h-16 items-center gap-4">
        <Logo />
        <div className="hidden max-w-xl flex-1 md:block">
          <Suspense>
            <SearchBar />
          </Suspense>
        </div>
        <nav className="ml-auto flex items-center gap-2">
          <Link href="/search" className="btn-ghost hidden lg:inline-flex">
            Browse
          </Link>
          {current ? (
            <UserMenu
              name={profile?.full_name || current.user.email || "Account"}
              avatarUrl={profile?.avatar_url ?? null}
              isAdmin={profile?.role === "admin"}
            />
          ) : (
            <Link href="/login" className="btn-ghost">
              Log in
            </Link>
          )}
          <Link href="/post" className="btn-accent hidden sm:inline-flex">
            <Plus className="h-4 w-4" /> Post an ad
          </Link>
        </nav>
      </div>
      <div className="container-page pb-3 md:hidden">
        <Suspense>
          <SearchBar />
        </Suspense>
      </div>
    </header>
  );
}
