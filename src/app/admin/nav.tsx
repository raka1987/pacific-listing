"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CreditCard,
  Flag,
  History,
  LayoutDashboard,
  List,
  Mail,
  Megaphone,
  Rocket,
  Settings,
  Store,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/types";

type Item = { href: string; label: string; icon: LucideIcon; badge?: string; roles: Role[] };

const MOD: Role[] = ["admin", "moderator"];
const SALES: Role[] = ["admin", "sales"];
const ALL: Role[] = ["admin", "moderator", "sales"];

const GROUPS: { title: string; items: Item[] }[] = [
  { title: "", items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard, roles: ALL }] },
  {
    title: "Moderation",
    items: [
      { href: "/admin/listings", label: "Listings", icon: List, badge: "pending", roles: MOD },
      { href: "/admin/reports", label: "Reports", icon: Flag, badge: "reports", roles: MOD },
      { href: "/admin/messages", label: "Messages", icon: Mail, badge: "messages", roles: ALL },
      { href: "/admin/notices", label: "Notice board", icon: Bell, roles: MOD },
    ],
  },
  {
    title: "Revenue",
    items: [
      { href: "/admin/payments", label: "Payments", icon: CreditCard, badge: "payments", roles: SALES },
      { href: "/admin/promotions", label: "Promotions & fees", icon: Rocket, roles: SALES },
      { href: "/admin/ads", label: "Banner ads", icon: Megaphone, roles: SALES },
      { href: "/admin/business", label: "Business plans", icon: Store, roles: SALES },
    ],
  },
  {
    title: "People",
    items: [
      { href: "/admin/users", label: "Users & staff", icon: Users, roles: ["admin"] },
      { href: "/admin/activity", label: "Activity log", icon: History, roles: ["admin"] },
      { href: "/admin/settings", label: "Settings", icon: Settings, roles: ["admin"] },
    ],
  },
];

export function AdminNav({ counts, role }: { counts: Record<string, number>; role: Role }) {
  const pathname = usePathname();
  return (
    <nav className="scrollbar-none flex gap-1 overflow-x-auto lg:flex-col lg:gap-0.5">
      {GROUPS.map((g) => {
        const items = g.items.filter((i) => i.roles.includes(role));
        if (!items.length) return null;
        return (
          <div key={g.title} className="flex gap-1 lg:mb-4 lg:flex-col lg:gap-0.5">
            {g.title && <p className="hidden px-3 pb-1 text-[11px] font-semibold tracking-wider text-slate-500 uppercase lg:block">{g.title}</p>}
            {items.map(({ href, label, icon: Icon, badge }) => {
              const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
              const n = badge ? counts[badge] : 0;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                    active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                  {n > 0 && <span className="ml-auto rounded-full bg-coral-500 px-2 py-0.5 text-xs font-bold text-white">{n}</span>}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
