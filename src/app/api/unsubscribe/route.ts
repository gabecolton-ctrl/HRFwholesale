import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// One-click unsubscribe used by Gmail/Outlook's built-in "Unsubscribe" button.
export async function POST(request: NextRequest) {
  const t = request.nextUrl.searchParams.get("t") ?? "";
  if (UUID.test(t)) await createAdminClient().from("cash_buyers").update({ email_alerts: false }).eq("unsubscribe_token", t);
  return new NextResponse("Unsubscribed", { status: 200 });
}

// A plain visit shows the confirmation page instead (link scanners can't unsubscribe people).
export async function GET(request: NextRequest) {
  const url = new URL("/alerts/unsubscribe", request.nextUrl.origin);
  url.searchParams.set("t", request.nextUrl.searchParams.get("t") ?? "");
  return NextResponse.redirect(url);
}
