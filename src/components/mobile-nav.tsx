"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Home, LayoutGrid, Plus, User } from "lucide-react";

const ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/search", label: "Browse", icon: LayoutGrid },
  { href: "/post", label: "List", icon: Plus, primary: true },
  { href: "/favorites", label: "Saved", icon: Heart },
  { href: "/my-ads", label: "Account", icon: User },
];

export function MobileNav() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin") || /^\/listing\/[^/]+$/.test(pathname)) return null;
  return (
    <nav className="glass fixed inset-x-0 bottom-0 z-40 border-t border-line pb-[env(safe-area-inset-bottom)] sm:hidden">
      <ul className="grid grid-cols-5">
        {ITEMS.map(({ href, label, icon: Icon, primary }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex flex-col items-center gap-1 pt-2 pb-1.5 text-[11px] font-semibold transition ${active ? "text-lagoon-600" : "text-muted"}`}
              >
                {primary ? (
                  <span className="-mt-1 flex h-9 w-12 items-center justify-center rounded-2xl bg-gradient-to-b from-coral-400 to-coral-500 text-white shadow-md shadow-coral-500/30">
                    <Icon className="h-5 w-5" strokeWidth={2.5} />
                  </span>
                ) : (
                  <span className={`flex h-8 w-12 items-center justify-center rounded-2xl transition ${active ? "bg-lagoon-100" : ""}`}>
                    <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
                  </span>
                )}
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
