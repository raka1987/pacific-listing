"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Bell,
  ChevronDown,
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
  const [open, setOpen] = useState(false);
  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => i.roles.includes(role)) })).filter((g) => g.items.length);
  const all = groups.flatMap((g) => g.items);
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
  const current = all.filter((i) => isActive(i.href)).sort((a, b) => b.href.length - a.href.length)[0] ?? all[0];
  const waiting = all.reduce((n, i) => n + (i.badge ? counts[i.badge] ?? 0 : 0), 0);

  // Close the phone menu after moving to another page.
  useEffect(() => setOpen(false), [pathname]);

  const list = (
    <>
      {groups.map((g) => (
        <div key={g.title} className="mb-3 flex flex-col gap-0.5 lg:mb-4">
          {g.title && <p className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">{g.title}</p>}
          {g.items.map(({ href, label, icon: Icon, badge }) => {
            const n = badge ? counts[badge] : 0;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition lg:py-2 ${
                  isActive(href) ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
                {n > 0 && <span className="ml-auto rounded-full bg-coral-500 px-2 py-0.5 text-xs font-bold text-white">{n}</span>}
              </Link>
            );
          })}
        </div>
      ))}
    </>
  );

  return (
    <>
      {/* Phones: one button that opens the whole menu */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-center gap-3 rounded-xl bg-white/10 px-3.5 py-3 text-sm font-medium text-white"
        >
          <current.icon className="h-4 w-4" />
          <span className="flex-1 text-left">{current.label}</span>
          {waiting > 0 && !open && <span className="rounded-full bg-coral-500 px-2 py-0.5 text-xs font-bold text-white">{waiting}</span>}
          <span className="text-xs text-slate-400">{open ? "Close" : "Menu"}</span>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <nav className="mt-3 border-t border-white/10 pt-3" aria-label="Admin">
            {list}
            <Link href="/" className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400 hover:text-white">
              <ArrowLeft className="h-4 w-4" /> Back to site
            </Link>
          </nav>
        )}
      </div>
      {/* Computers: the full menu down the side */}
      <nav className="hidden lg:block" aria-label="Admin">
        {list}
      </nav>
    </>
  );
}
