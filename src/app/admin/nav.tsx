"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Flag, LayoutDashboard, List, Mail, Settings, Users } from "lucide-react";

const ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/listings", label: "Listings", icon: List, badge: "pending" },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/reports", label: "Reports", icon: Flag, badge: "reports" },
  { href: "/admin/messages", label: "Messages", icon: Mail, badge: "messages" },
  { href: "/admin/notices", label: "Notice board", icon: Bell },
  { href: "/admin/settings", label: "Settings", icon: Settings },
] as const;

export function AdminNav({ counts }: { counts: Record<string, number> }) {
  const pathname = usePathname();
  return (
    <nav className="scrollbar-none flex gap-1 overflow-x-auto lg:flex-col">
      {ITEMS.map(({ href, label, icon: Icon, ...rest }) => {
        const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
        const n = "badge" in rest ? counts[rest.badge] : 0;
        return (
          <Link
            key={href}
            href={href}
            className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
            {n > 0 && <span className="ml-auto rounded-full bg-coral-500 px-2 py-0.5 text-xs font-bold text-white">{n}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
