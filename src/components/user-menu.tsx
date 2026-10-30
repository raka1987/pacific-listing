"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Heart, List, LogOut, Receipt, Shield, Store, User } from "lucide-react";
import { Avatar } from "./avatar";

export function UserMenu({ name, avatarUrl, isAdmin }: { name: string; avatarUrl: string | null; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const item = "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-subtle";
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pr-2.5 pl-1 hover:bg-subtle"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Avatar name={name} url={avatarUrl} size={30} />
        <span className="hidden max-w-28 truncate text-sm font-medium lg:block">{name.split(" ")[0] || "Account"}</span>
        <ChevronDown className="h-4 w-4 text-faint" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 rounded-2xl border border-line bg-surface p-2 shadow-xl"
        >
          <Link href="/my-ads" className={item} role="menuitem" onClick={() => setOpen(false)}>
            <List className="h-4 w-4" /> My ads
          </Link>
          <Link href="/favorites" className={item} role="menuitem" onClick={() => setOpen(false)}>
            <Heart className="h-4 w-4" /> Saved
          </Link>
          <Link href="/profile" className={item} role="menuitem" onClick={() => setOpen(false)}>
            <User className="h-4 w-4" /> Profile
          </Link>
          <Link href="/orders" className={`${item} hide-in-app`} role="menuitem" onClick={() => setOpen(false)}>
            <Receipt className="h-4 w-4" /> Payments
          </Link>
          <Link href="/business" className={`${item} hide-in-app`} role="menuitem" onClick={() => setOpen(false)}>
            <Store className="h-4 w-4" /> Business account
          </Link>
          {isAdmin && (
            <Link href="/admin" className={`${item} text-lagoon-700`} role="menuitem" onClick={() => setOpen(false)}>
              <Shield className="h-4 w-4" /> Admin panel
            </Link>
          )}
          <div className="my-1 border-t border-line" />
          <form action="/auth/signout" method="post">
            <button className={`${item} w-full`} role="menuitem">
              <LogOut className="h-4 w-4" /> Log out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
