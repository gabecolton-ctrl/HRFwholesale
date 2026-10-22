import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/SubmitButton";

export const metadata = { title: "Set your password", robots: { index: false } };

async function setPassword(fd: FormData) {
  "use server";
  const pw = String(fd.get("password") ?? "");
  if (pw.length < 10) redirect("/reset-password?error=short");
  if (pw !== String(fd.get("confirm") ?? "")) redirect("/reset-password?error=match");
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: pw });
  if (error) redirect("/reset-password?error=failed");
  redirect("/login");
}

export default async function ResetPassword({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login?error=link");
  const msg = { short: "Use at least 10 characters.", match: "Passwords don't match.", failed: "Couldn't update. Try a different password." }[error ?? ""];
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <form action={setPassword} className="card space-y-4 p-6">
          <h1 className="h-display text-2xl font-semibold">Set your password</h1>
          {msg && <p className="rounded-lg bg-danger/5 px-3 py-2 text-sm text-danger">{msg}</p>}
          <div><label className="label" htmlFor="password">New password</label><input id="password" name="password" type="password" minLength={10} required className="input" autoComplete="new-password" /></div>
          <div><label className="label" htmlFor="confirm">Confirm password</label><input id="confirm" name="confirm" type="password" minLength={10} required className="input" autoComplete="new-password" /></div>
          <SubmitButton className="btn btn-dark w-full">Save password</SubmitButton>
        </form>
      </div>
    </main>
  );
}
