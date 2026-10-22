import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { BuyBoxFields } from "@/components/BuyBoxFields";
import { SubmitButton } from "@/components/SubmitButton";
import { dateShort } from "@/lib/format";
import { updateBuyBox, uploadPof } from "../actions";

export const metadata = { title: "My account", robots: { index: false } };

export default async function Portal({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { supabase, profile } = await requireRole("buyer");
  const { saved, error } = await searchParams;
  const { data: b } = await supabase.from("cash_buyers").select("*").maybeSingle();

  return (
    <>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="h-display text-3xl font-semibold">My account</h1>
          <p className="mt-1 text-ink-soft">Signed in as {profile.full_name ?? profile.email}. Your buy box decides which deal alerts you get.</p>
        </div>
        {saved && <p className="rounded-lg bg-sage/10 px-4 py-3 text-sm font-medium text-sage">Saved.</p>}
        {error && <p className="rounded-lg bg-danger/5 px-4 py-3 text-sm font-medium text-danger">{error}</p>}


        {!b ? (
          <section className="card p-6">
            <p>We couldn't find your buyer profile. Please <Link className="underline" href="/contact">contact us</Link>.</p>
          </section>
        ) : (
          <>
            <section className="card p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="h-display text-xl font-semibold">Proof of funds</h2>
                {b.pof_verified ? (
                  <span className="pill bg-sage/15 text-sage">Verified</span>
                ) : b.pof_path ? (
                  <span className="pill bg-amber/15 text-amber">Under review</span>
                ) : (
                  <span className="pill bg-danger/10 text-danger">Missing</span>
                )}
              </div>
              {b.pof_uploaded_at && <p className="mt-1 text-sm text-ink-soft">Last uploaded {dateShort(b.pof_uploaded_at)}</p>}
              <form action={uploadPof} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                <input name="pof" type="file" required accept="application/pdf,image/jpeg,image/png,image/heic,image/webp"
                  className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-ink file:px-4 file:font-semibold file:text-white" />
                <SubmitButton className="btn btn-dark shrink-0" pendingText="Uploading…">Upload</SubmitButton>
              </form>
              <p className="hint">PDF or photo, up to 4 MB.</p>
            </section>

            <form action={updateBuyBox} className="card space-y-5 p-6">
              <h2 className="h-display text-xl font-semibold">Your details & buy box</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label className="label" htmlFor="name">Name</label><input id="name" name="name" className="input" defaultValue={b.name} required /></div>
                <div><label className="label" htmlFor="company">Company</label><input id="company" name="company" className="input" defaultValue={b.company ?? ""} /></div>
                <div><label className="label" htmlFor="phone">Phone</label><input id="phone" name="phone" type="tel" className="input" defaultValue={b.phone ?? ""} /></div>
                <div><label className="label">Email</label><input className="input bg-paper" value={b.email ?? ""} readOnly /></div>
              </div>
              <BuyBoxFields d={b} />
              <label className="flex gap-3 text-sm"><input type="checkbox" name="email_alerts" defaultChecked={b.email_alerts} className="check" /> Email me deals that match my buy box</label>
              {b.sms_consent && (
                <label className="flex gap-3 text-sm"><input type="checkbox" name="sms_off" className="check" /> Stop calls and texts about deals</label>
              )}
              <SubmitButton className="btn btn-primary">Save changes</SubmitButton>
            </form>
          </>
        )}
      </div>
    </>
  );
}
