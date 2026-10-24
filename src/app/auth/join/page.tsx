import { redirect } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { Logo } from "@/components/Logo";
import { SubmitButton } from "@/components/SubmitButton";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Set up your account", robots: { index: false } };

// The link is only used when the person taps the button, so email
// security scanners that "pre-open" links can't use it up.
async function join(fd: FormData) {
  "use server";
  const token_hash = String(fd.get("token_hash") ?? "");
  const type = String(fd.get("type") ?? "") as EmailOtpType;
  if (!token_hash || !["invite", "recovery", "magiclink", "signup", "email"].includes(type)) redirect("/auth/join?bad=1");
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash, type });
  if (error) redirect("/auth/join?bad=1");
  redirect("/reset-password");
}

export default async function Join({ searchParams }: { searchParams: Promise<{ token_hash?: string; type?: string; bad?: string }> }) {
  const sp = await searchParams;
  const ok = sp.token_hash && sp.type && !sp.bad;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <Logo />
      <div className="card mt-8 w-full max-w-md p-6">
        {ok ? (
          <form action={join}>
            <input type="hidden" name="token_hash" value={sp.token_hash} />
            <input type="hidden" name="type" value={sp.type} />
            <h1 className="h-display text-2xl font-semibold">Set up your account</h1>
            <p className="mt-2 text-ink-soft">Tap below to choose your password for the H.R.F Assets LLC CRM.</p>
            <SubmitButton className="btn btn-primary mt-5 w-full" pendingText="One moment…">Continue</SubmitButton>
          </form>
        ) : (
          <>
            <h1 className="h-display text-2xl font-semibold">This link has expired</h1>
            <p className="mt-2 text-ink-soft">Setup links work once and expire. Ask the owner to send a new invite from CRM → Team.</p>
          </>
        )}
      </div>
    </main>
  );
}
