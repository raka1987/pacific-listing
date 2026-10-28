"use client";

import { Heart } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toggleFavorite } from "@/app/actions";

export function FavoriteButton({
  listingId,
  initial,
  variant = "icon",
}: {
  listingId: string;
  initial: boolean;
  variant?: "icon" | "button";
}) {
  const [saved, setSaved] = useState(initial);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    const next = !saved;
    setSaved(next);
    startTransition(async () => {
      const res = await toggleFavorite(listingId, next);
      if (res.error === "auth") {
        setSaved(!next);
        router.push(`/login?next=${encodeURIComponent(pathname)}`);
      } else if (res.error) {
        setSaved(!next);
      }
    });
  }

  if (variant === "button") {
    return (
      <button onClick={onClick} disabled={pending} className="btn-secondary w-full" aria-pressed={saved}>
        <Heart className={`h-4 w-4 ${saved ? "fill-coral-500 text-coral-500" : ""}`} />
        {saved ? "Saved" : "Save"}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={pending}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save listing"}
      className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur transition hover:scale-105"
    >
      <Heart className={`h-[18px] w-[18px] ${saved ? "fill-coral-500 text-coral-500" : "text-slate-600"}`} />
    </button>
  );
}
