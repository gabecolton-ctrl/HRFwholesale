import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Email links (sign-up confirmation, invites, password reset) land here.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const nextParam = url.searchParams.get("next") ?? "/crm";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/crm";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      const dest = type === "recovery" || type === "invite" ? "/reset-password" : next;
      return NextResponse.redirect(new URL(dest, url.origin));
    }
  }
  return NextResponse.redirect(new URL("/login?error=link", url.origin));
}
