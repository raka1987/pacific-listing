import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Counts a click on a banner, then sends the visitor to the advertiser.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (/^[0-9a-f-]{36}$/i.test(id)) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("record_ad_click", { p_id: id });
    if (typeof data === "string" && /^https?:\/\//.test(data)) return NextResponse.redirect(data);
  }
  return NextResponse.redirect(new URL("/", request.url));
}
