"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { COUNTRY_COOKIE, regionByCode } from "@/lib/location";

export async function setViewerCountry(code: string) {
  if (!regionByCode(code)) return;
  (await cookies()).set(COUNTRY_COOKIE, code, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}
