"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { COUNTRIES } from "@/lib/constants";
import { COUNTRY_COOKIE, regionByCode } from "@/lib/location";
import { SEARCH_COUNTRY_COOKIE } from "@/lib/search-country";

export async function setViewerCountry(code: string) {
  if (!regionByCode(code)) return;
  const jar = await cookies();
  const year = { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" as const };
  jar.set(COUNTRY_COOKIE, code, year);
  // Picking where you are also sets where searches start (All Pacific when abroad).
  jar.set(SEARCH_COUNTRY_COOKIE, COUNTRIES.some((c) => c.code === code) ? code : "all", year);
  revalidatePath("/", "layout");
}
