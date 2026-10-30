"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/** Counts one view of a banner per visitor session. */
export function AdImpression({ id }: { id: string }) {
  useEffect(() => {
    const key = `ad-seen:${id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // storage unavailable: still count it
    }
    createClient().rpc("record_ad_impression", { p_id: id });
  }, [id]);
  return null;
}
