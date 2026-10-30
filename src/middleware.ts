import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Without these settings nothing can load, so say so plainly instead of erroring.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return new NextResponse(
      "Pacific Listing isn't connected to its database yet.\n\n" +
        "In Vercel, open the project > Settings > Environment Variables and add\n" +
        "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (from Supabase > Project Settings > API),\n" +
        "then redeploy (Deployments > ... > Redeploy).",
      { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|sw.js|offline.html|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
