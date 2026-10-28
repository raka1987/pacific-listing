"use client";

import { useEffect } from "react";
import { recordView } from "@/app/actions";

export function ViewTracker({ listingId }: { listingId: string }) {
  useEffect(() => {
    const key = `viewed:${listingId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // storage unavailable: still count the view
    }
    recordView(listingId);
  }, [listingId]);
  return null;
}
