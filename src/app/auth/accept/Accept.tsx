"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

// Handles every kind of email link Supabase can send (default or custom templates):
//   #access_token=…&refresh_token=…&type=invite|recovery|signup   (default invite emails)
//   ?code=…                                                         (sign-up / reset from this site)
//   ?token_hash=…&type=…                                            (custom templates)
//   #error=…&error_code=otp_expired                                 (used or expired link)
export function Accept() {
  const router = useRouter();
  const params = useSearchParams();
  const [state, setState] = useState<"working" | "expired" | "confirmed">("working");

  useEffect(() => {
    const supabase = createClient();
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const nextParam = params.get("next") ?? "/crm";
    const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/crm";
    const go = (path: string) => {
      router.replace(path);
      router.refresh();
    };

    (async () => {
      if (hash.get("error") || params.get("error")) return setState("expired");

      const access_token = hash.get("access_token");
      const refresh_token = hash.get("refresh_token");
      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error) return setState("expired");
        const type = hash.get("type");
        return go(type === "invite" || type === "recovery" ? "/reset-password" : next);
      }

      const code = params.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        // Opened on another device: the email is already confirmed, they just need to sign in.
        if (error) return setState("confirmed");
        return go(next);
      }

      const token_hash = params.get("token_hash");
      const type = params.get("type") as EmailOtpType | null;
      if (token_hash && type) {
        const { error } = await supabase.auth.verifyOtp({ token_hash, type });
        if (error) return setState("expired");
        return go(type === "invite" || type === "recovery" ? "/reset-password" : next);
      }

      setState("expired");
    })();
  }, [params, router]);

  if (state === "working") return <p className="text-ink-soft">Checking your link…</p>;
  if (state === "confirmed")
    return (
      <>
        <h1 className="h-display text-2xl font-semibold">Email confirmed</h1>
        <p className="mt-2 text-ink-soft">You're all set. Sign in to continue.</p>
        <Link href="/login" className="btn btn-dark mt-5 w-full">Sign in</Link>
      </>
    );
  return (
    <>
      <h1 className="h-display text-2xl font-semibold">This link has expired</h1>
      <p className="mt-2 text-ink-soft">
        Email links work once and expire after a while. If you were invited to the team, ask for a new invite. Otherwise,
        sign in, or use "Forgot password?" to get a fresh link.
      </p>
      <Link href="/login" className="btn btn-dark mt-5 w-full">Go to sign in</Link>
    </>
  );
}
