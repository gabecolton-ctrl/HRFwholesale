"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { site } from "@/lib/site";

export type LoginState = { error?: string; notice?: string; email?: string };

function safeNext(n: FormDataEntryValue | null) {
  const s = String(n ?? "");
  return s.startsWith("/") && !s.startsWith("//") ? s : "";
}

export async function signIn(_prev: LoginState, fd: FormData): Promise<LoginState> {
  const email = String(fd.get("email") ?? "").trim();
  const password = String(fd.get("password") ?? "");
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { error: "Sign-in isn't connected yet: add the Supabase keys in Vercel and redeploy.", email };
  }
  const supabase = await createClient();
  let data, error;
  try {
    ({ data, error } = await supabase.auth.signInWithPassword({ email, password }));
  } catch {
    return { error: "Couldn't reach the login service. Check the Supabase URL and key in Vercel.", email };
  }
  if (error || !data.user) {
    const msg = error?.message?.toLowerCase().includes("confirm")
      ? "Please confirm your email first. Check your inbox for the link."
      : "That email and password don't match.";
    return { error: msg, email };
  }
  const { data: p } = await supabase.from("profiles").select("role,active").eq("id", data.user.id).single();
  const next = safeNext(fd.get("next"));
  if (p?.role === "buyer") redirect(next.startsWith("/portal") ? next : "/portal");
  if (p && p.active && p.role !== "pending") redirect(next.startsWith("/crm") ? next : "/crm");
  redirect("/no-access");
}

export async function sendReset(_prev: LoginState, fd: FormData): Promise<LoginState> {
  const email = String(fd.get("email") ?? "").trim();
  if (!email) return { error: "Enter your email first, then tap “Forgot password”." };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${site.url}/auth/accept?next=/reset-password` });
  return { notice: "If that email has an account, a reset link is on its way.", email };
}
