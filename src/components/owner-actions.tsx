"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { CheckCircle2, Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { deleteListing, setListingStatus } from "@/app/actions";
import type { ListingStatus } from "@/lib/types";

export function OwnerActions({ id, status, compact = false }: { id: string; status: ListingStatus; compact?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ error?: string }>, after?: () => void) {
    startTransition(async () => {
      const res = await fn();
      if (res.error) alert(res.error);
      else {
        after?.();
        router.refresh();
      }
    });
  }

  const cls = compact ? "btn-secondary px-3 py-2 text-xs" : "btn-secondary";
  return (
    <div className={`flex flex-wrap gap-2 ${pending ? "pointer-events-none opacity-60" : ""}`}>
      <Link href={`/listing/${id}/edit`} className={cls}>
        <Pencil className="h-4 w-4" /> Edit
      </Link>
      {status === "active" && (
        <button className={cls} onClick={() => run(() => setListingStatus(id, "sold"))}>
          <CheckCircle2 className="h-4 w-4" /> Mark sold
        </button>
      )}
      {status === "active" && (
        <button className={cls} onClick={() => run(() => setListingStatus(id, "hidden"))}>
          <EyeOff className="h-4 w-4" /> Hide
        </button>
      )}
      {(status === "hidden" || status === "sold") && (
        <button className={cls} onClick={() => run(() => setListingStatus(id, "active"))}>
          <Eye className="h-4 w-4" /> Relist
        </button>
      )}
      <button
        className={compact ? "btn-danger px-3 py-2 text-xs" : "btn-danger"}
        onClick={() => {
          if (confirm("Delete this ad permanently? This can't be undone.")) {
            run(() => deleteListing(id), () => compact || router.push("/my-ads"));
          }
        }}
      >
        <Trash2 className="h-4 w-4" /> Delete
      </button>
    </div>
  );
}
