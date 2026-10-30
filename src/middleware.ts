import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfigProblem } from "@/lib/supabase/env";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // If the database settings are wrong nothing can load, so say exactly what to fix.
  const problem = supabaseConfigProblem();
  if (problem) {
    return new NextResponse(
      "Pacific Listing can't connect to its database.\n\n" +
        problem +
        "\n\nFix it in Vercel: open the project > Settings > Environment Variables, edit the value,\n" +
        "then go to Deployments > ... (next to the latest) > Redeploy.",
      { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }
  try {
    return await updateSession(request);
  } catch (e) {
    // Never block the page because the login check failed; the visitor is treated as logged out.
    console.error("middleware: session refresh failed", e);
    return NextResponse.next({ request });
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|sw.js|offline.html|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
