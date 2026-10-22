import Link from "next/link";
import { BuyBoxFields } from "@/components/BuyBoxFields";
import { SubmitButton } from "@/components/SubmitButton";
import { saveBuyer } from "@/app/crm/buyers/actions";

type B = Record<string, unknown> & { id?: string; areas?: string[]; property_types?: string[]; rehab_levels?: string[]; strategies?: string[] };
const s = (b: B, k: string) => (b[k] === null || b[k] === undefined ? "" : String(b[k]));

export function BuyerEditor({ b = {} }: { b?: B }) {
  return (
    <form action={saveBuyer} className="space-y-5">
      {b.id && <input type="hidden" name="id" value={b.id} />}
      <section className="card grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
        <h2 className="col-span-full text-sm font-bold tracking-wide text-ink-soft uppercase">Contact</h2>
        <div><label className="label" htmlFor="name">Name</label><input id="name" name="name" className="input" required defaultValue={s(b, "name")} /></div>
        <div><label className="label" htmlFor="company">Company</label><input id="company" name="company" className="input" defaultValue={s(b, "company")} /></div>
        <div><label className="label" htmlFor="phone">Phone</label><input id="phone" name="phone" type="tel" className="input" defaultValue={s(b, "phone")} /></div>
        <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" className="input" defaultValue={s(b, "email")} /></div>
        <div><label className="label" htmlFor="source">Where we found them</label>
          <input id="source" name="source" className="input" list="buyer-sources" defaultValue={s(b, "source")} />
          <datalist id="buyer-sources"><option>Deed records</option><option>REIA meetup</option><option>Investor sign</option><option>Referral</option><option>Website sign-up</option><option>Facebook group</option></datalist>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label" htmlFor="tier">Tier</label>
            <select id="tier" name="tier" className="input" defaultValue={s(b, "tier") || "B"}><option value="A">A · first look</option><option value="B">B</option><option value="C">C</option></select></div>
          <div><label className="label" htmlFor="status">Status</label>
            <select id="status" name="status" className="input" defaultValue={s(b, "status") || "Active"}><option>Active</option><option>Inactive</option></select></div>
        </div>
      </section>

      <section className="card p-4 sm:p-5">
        <h2 className="mb-3 text-sm font-bold tracking-wide text-ink-soft uppercase">Buy box</h2>
        <BuyBoxFields d={b as never} />
      </section>

      <section className="card grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
        <h2 className="col-span-full text-sm font-bold tracking-wide text-ink-soft uppercase">Proof of funds</h2>
        <div className="col-span-full flex flex-wrap items-center gap-3">
          {b.pof_path ? (
            <Link href={`/api/files/pof/${b.id}`} target="_blank" className="btn btn-ghost btn-sm">View current proof of funds</Link>
          ) : (
            <span className="text-sm text-ink-soft">None uploaded yet.</span>
          )}
        </div>
        <div><label className="label" htmlFor="pof">{b.pof_path ? "Replace file" : "Upload file"}</label>
          <input id="pof" name="pof" type="file" accept="application/pdf,image/jpeg,image/png,image/heic,image/webp" className="block w-full text-sm" />
          <p className="hint">PDF or photo, up to 4 MB.</p></div>
        <div><label className="label" htmlFor="pof_amount">Verified amount</label><input id="pof_amount" name="pof_amount" inputMode="numeric" className="input" defaultValue={s(b, "pof_amount")} /></div>
        <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="pof_verified" defaultChecked={b.pof_verified === true} className="check mt-0" /> I reviewed it, POF verified</label>
        <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="email_alerts" defaultChecked={b.id ? b.email_alerts === true : true} className="check mt-0" /> Send email deal alerts</label>
        {b.id && <p className="col-span-full text-xs text-ink-soft">Texts/calls about deals: {b.sms_consent ? "agreed on sign-up" : "no consent on file, email only"}.</p>}
      </section>

      <section className="card p-4 sm:p-5">
        <label className="label" htmlFor="notes">Notes</label>
        <textarea id="notes" name="notes" rows={4} className="input" defaultValue={s(b, "notes")} placeholder="What they've bought, how fast they close, who to call" />
      </section>

      <div className="sticky bottom-16 z-10 -mx-4 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur lg:bottom-0">
        <SubmitButton className="btn btn-primary w-full sm:w-auto">{b.id ? "Save changes" : "Add buyer"}</SubmitButton>
      </div>
    </form>
  );
}
