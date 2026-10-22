import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Deal alerts", robots: { index: false } };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function setAlerts(fd: FormData) {
  "use server";
  const t = String(fd.get("t") ?? "");
  const on = fd.get("on") === "1";
  if (UUID.test(t)) await createAdminClient().from("cash_buyers").update({ email_alerts: on }).eq("unsubscribe_token", t);
  redirect(`/alerts/unsubscribe?t=${encodeURIComponent(t)}&done=${on ? "on" : "off"}`);
}

export default async function Unsubscribe({ searchParams }: { searchParams: Promise<{ t?: string; done?: string }> }) {
  const { t = "", done } = await searchParams;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <Logo />
      <div className="card mt-8 w-full max-w-md p-6">
        {done === "off" ? (
          <>
            <h1 className="h-display text-2xl font-semibold">You're unsubscribed</h1>
            <p className="mt-2 text-ink-soft">You won't get deal alert emails anymore.</p>
            <form action={setAlerts} className="mt-4"><input type="hidden" name="t" value={t} /><input type="hidden" name="on" value="1" />
              <button className="text-sm underline">Changed your mind? Turn alerts back on</button></form>
          </>
        ) : done === "on" ? (
          <><h1 className="h-display text-2xl font-semibold">Alerts are back on</h1><p className="mt-2 text-ink-soft">We'll email you deals that match your buy box.</p></>
        ) : !UUID.test(t) ? (
          <p className="text-ink-soft">This link isn't valid. Sign in to your buyer portal to change your alert settings.</p>
        ) : (
          <>
            <h1 className="h-display text-2xl font-semibold">Stop deal alert emails?</h1>
            <p className="mt-2 text-ink-soft">You can turn them back on anytime from your buyer portal.</p>
            <form action={setAlerts} className="mt-5"><input type="hidden" name="t" value={t} /><input type="hidden" name="on" value="0" />
              <button className="btn btn-dark w-full">Unsubscribe</button></form>
          </>
        )}
      </div>
    </main>
  );
}
