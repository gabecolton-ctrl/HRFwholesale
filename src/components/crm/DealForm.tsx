"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { createDeal, updateDeal, type DealFormState } from "@/app/crm/pipeline/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { DEAL_STATUSES, EXIT_STRATEGIES, PROPERTY_TYPES, REHAB_LEVELS, US_STATES, type AppRole } from "@/lib/constants";
import { ASSIGNMENT_DISCLOSURE } from "@/lib/site";
import { CompsEditor } from "@/components/crm/CompsEditor";

type Deal = Record<string, unknown> & { id?: string };
type Opt = { id: string; label: string };

const s = (d: Deal, k: string) => (d[k] === null || d[k] === undefined ? "" : String(d[k]));
const n = (x: string) => (x === "" ? null : Number(x.replace(/[$,\s]/g, "")));
const fmt = (v: number | null) => (v === null || !Number.isFinite(v) ? "—" : v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }));

export function DealForm({ deal = {}, role, buyers, reps }: { deal?: Deal; role: AppRole; buyers: Opt[]; reps: { acq: Opt[]; dispo: Opt[] } }) {
  const editing = Boolean(deal.id);
  const [state, action] = useActionState<DealFormState, FormData>(editing ? updateDeal : createDeal, {});
  const canDispo = role === "owner" || role === "dispositions";

  // live numbers
  const [arv, setArv] = useState(s(deal, "arv"));
  const [rep, setRep] = useState(s(deal, "repair_estimate"));
  const [cp, setCp] = useState(s(deal, "contract_price"));
  const [ap, setAp] = useState(s(deal, "assignment_price"));
  const [sellerSigned, setSellerSigned] = useState(deal.seller_disclosure_signed === true);
  const [buyerSigned, setBuyerSigned] = useState(deal.buyer_disclosure_signed === true);
  const [status, setStatus] = useState(s(deal, "status") || "Under contract");
  const [exit, setExit] = useState(s(deal, "exit_strategy") || "Assignment");
  const [buyer, setBuyer] = useState(s(deal, "end_buyer_id"));
  const [signedDate, setSignedDate] = useState(s(deal, "contract_signed_date"));
  const [sqft, setSqft] = useState(s(deal, "sqft"));

  const math = useMemo(() => {
    const a = n(arv), r = n(rep) ?? 0, c = n(cp), x = n(ap);
    const base = a !== null ? a * 0.7 - r : null;
    return { base, fee: c !== null && x !== null ? x - c : null, over: base !== null && c !== null && c > base };
  }, [arv, rep, cp, ap]);

  const needsBuyerDisclosure = ["Buyer assigned", "Clear to close", "Closed"].includes(status) && exit !== "Keep";
  const blockStatus = needsBuyerDisclosure && (!buyerSigned || !buyer);
  const canPublish = sellerSigned && Boolean(signedDate);

  const boxes = ["seller_disclosure_signed", "published_to_portal", ...(canDispo ? ["buyer_disclosure_signed", "buyer_emd_received"] : [])];

  return (
    <form action={action} className="space-y-5">
      {editing && <input type="hidden" name="id" value={String(deal.id)} />}
      {deal.lead_id ? <input type="hidden" name="lead_id" value={String(deal.lead_id)} /> : null}
      <input type="hidden" name="_checkboxes" value={boxes.join(",")} />
      {state.error && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm font-semibold text-danger">{state.error}</p>}

      <Card title="Property">
        <F label="Address" name="address" d={s(deal, "address")} required wide />
        <F label="City" name="city" d={s(deal, "city")} />
        <Sel label="State" name="state" d={s(deal, "state") || "TX"} options={US_STATES} noEmpty />
        <F label="ZIP" name="zip" d={s(deal, "zip")} />
        <F label="Area / neighborhood (shown to buyers)" name="area" d={s(deal, "area")} wide />
        <Sel label="Property type" name="property_type" d={s(deal, "property_type")} options={PROPERTY_TYPES} />
        <F label="Beds" name="beds" d={s(deal, "beds")} />
        <F label="Baths" name="baths" d={s(deal, "baths")} />
        <div><label className="label" htmlFor="sqft">Sq ft</label><input id="sqft" name="sqft" className="input" inputMode="numeric" value={sqft} onChange={(e) => setSqft(e.target.value)} /></div>
        <F label="Year built" name="year_built" d={s(deal, "year_built")} />
        <Sel label="Rehab level" name="rehab_level" d={s(deal, "rehab_level")} options={REHAB_LEVELS} />
        <div><label className="label" htmlFor="arv">ARV</label><input id="arv" name="arv" className="input" inputMode="numeric" value={arv} onChange={(e) => setArv(e.target.value)} /></div>
        <div><label className="label" htmlFor="repair_estimate">Repair estimate</label><input id="repair_estimate" name="repair_estimate" className="input" inputMode="numeric" value={rep} onChange={(e) => setRep(e.target.value)} /></div>
        <div className="col-span-full"><label className="label" htmlFor="description">Description for buyers</label><textarea id="description" name="description" rows={3} className="input" defaultValue={s(deal, "description")} /></div>
        <CompsEditor initial={deal.comps} subjectSqft={sqft} onUseArv={setArv} />
      </Card>

      <Card title="Contract">
        <div><label className="label" htmlFor="contract_signed_date">Contract signed</label><input id="contract_signed_date" name="contract_signed_date" type="date" className="input" value={signedDate} onChange={(e) => setSignedDate(e.target.value)} /></div>
        <F label="Option period ends" name="option_period_end" type="date" d={s(deal, "option_period_end")} />
        <F label="Closing date" name="closing_date" type="date" d={s(deal, "closing_date")} />
        <Sel label="Exit" name="exit_strategy" d={exit} options={EXIT_STRATEGIES} onChange={setExit} noEmpty />
        <div><label className="label" htmlFor="contract_price">Contract price</label><input id="contract_price" name="contract_price" className="input" inputMode="numeric" value={cp} onChange={(e) => setCp(e.target.value)} /></div>
        <F label="Earnest money" name="earnest_money" d={s(deal, "earnest_money")} />
        <F label="Option fee" name="option_fee" d={s(deal, "option_fee")} />
        <F label="Title company" name="title_company" d={s(deal, "title_company")} />
        <F label="Title opened" name="title_opened_date" type="date" d={s(deal, "title_opened_date")} />
        <div className={`col-span-full rounded-lg p-3 text-sm ${math.over ? "bg-danger/5 text-danger" : "bg-paper"}`}>
          ARV × 70% − repairs = <strong>{fmt(math.base)}</strong>
          {math.over && <> · <strong>Contract price is above this.</strong> Pass or renegotiate unless your buyers pay more in this area.</>}
        </div>
      </Card>

      <Card title="Equitable-interest disclosures">
        <p className="col-span-full text-sm text-ink-soft">
          Every buyer-facing listing will carry: <em>&ldquo;{ASSIGNMENT_DISCLOSURE}&rdquo;</em>
        </p>
        <Disclosure side="seller" signed={sellerSigned} setSigned={setSellerSigned} date={s(deal, "seller_disclosure_date")} hasFile={Boolean(deal.seller_disclosure_path)} dealId={deal.id}
          rule="Required before the deal can be published to buyers." />
        {canDispo ? (
          <Disclosure side="buyer" signed={buyerSigned} setSigned={setBuyerSigned} date={s(deal, "buyer_disclosure_date")} hasFile={Boolean(deal.buyer_disclosure_path)} dealId={deal.id}
            rule="Required before the deal can be marked Buyer assigned." />
        ) : (
          <p className="text-sm text-ink-soft">Buyer disclosure: {deal.buyer_disclosure_signed ? "signed" : "not signed yet"} (handled by dispositions).</p>
        )}
      </Card>

      <Card title="Status, buyer & portal">
        <div>
          <label className="label" htmlFor="status">Status</label>
          <select id="status" name="status" className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            {DEAL_STATUSES.filter((x) => canDispo || ["Under contract", "Marketing", "Cancelled"].includes(x) || x === deal.status).map((x) => <option key={x}>{x}</option>)}
          </select>
          {blockStatus && <p className="mt-1 text-xs font-semibold text-danger">Needs a signed buyer disclosure and an end buyer.</p>}
        </div>
        {status === "Cancelled" && <F label="Why cancelled?" name="cancel_reason" d={s(deal, "cancel_reason")} wide />}
        {canDispo && (
          <>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="end_buyer_id">End buyer</label>
              <select id="end_buyer_id" name="end_buyer_id" className="input" value={buyer} onChange={(e) => setBuyer(e.target.value)}>
                <option value="">Not chosen</option>
                {buyers.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
              </select>
              {buyers.length === 0 && <p className="hint">No buyers yet. <Link className="underline" href="/crm/buyers/new">Add one</Link>.</p>}
            </div>
            <div><label className="label" htmlFor="assignment_price">Buyer pays (assignment price)</label><input id="assignment_price" name="assignment_price" className="input" inputMode="numeric" value={ap} onChange={(e) => setAp(e.target.value)} /></div>
            <F label="Buyer EMD (non-refundable)" name="buyer_emd" d={s(deal, "buyer_emd")} />
            <label className="flex min-h-11 items-center gap-2 text-sm font-medium"><input type="checkbox" name="buyer_emd_received" defaultChecked={deal.buyer_emd_received === true} className="check mt-0" /> Buyer EMD received</label>
            <div className="flex items-center rounded-lg bg-sage/10 px-3 text-sm">Fee: <strong className="ml-1">{fmt(math.fee)}</strong></div>
          </>
        )}
        {role === "owner" && (
          <>
            <Sel label="Acquisitions rep" name="acq_rep" d={s(deal, "acq_rep")} options={reps.acq.map((r) => [r.id, r.label] as [string, string])} />
            <Sel label="Dispositions" name="dispo_rep" d={s(deal, "dispo_rep")} options={reps.dispo.map((r) => [r.id, r.label] as [string, string])} />
          </>
        )}
        <div>
          <label className="label" htmlFor="list_price">Price shown to buyers</label>
          <input id="list_price" name="list_price" className="input" inputMode="numeric" defaultValue={s(deal, "list_price")} placeholder="e.g. 125000" />
          <p className="hint">Blank = uses the assignment price.</p>
        </div>
        <label className={`col-span-full flex items-start gap-3 rounded-lg border p-3 text-sm ${canPublish ? "border-line" : "border-dashed border-line bg-paper text-ink-soft"}`}>
          <input type="checkbox" name="published_to_portal" defaultChecked={deal.published_to_portal === true} disabled={!canPublish} className="check" />
          <span>
            <strong className="block text-ink">Publish to buyer portal</strong>
            {canPublish ? "Buyers see it in the portal. When you first publish, Tier A matching buyers are emailed automatically." : "Locked until the contract signed date is set and the seller disclosure is marked signed."}
          </span>
        </label>
        <div className="col-span-full"><label className="label" htmlFor="notes">Notes</label><textarea id="notes" name="notes" rows={3} className="input" defaultValue={s(deal, "notes")} /></div>
      </Card>

      <div className="sticky bottom-16 z-10 -mx-4 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur lg:bottom-0">
        <SubmitButton className="btn btn-primary w-full sm:w-auto">{editing ? "Save deal" : "Create deal"}</SubmitButton>
      </div>
    </form>
  );
}

function Disclosure({ side, signed, setSigned, date, hasFile, dealId, rule }: {
  side: "seller" | "buyer"; signed: boolean; setSigned: (b: boolean) => void; date: string; hasFile: boolean; dealId?: string; rule: string;
}) {
  const label = side === "seller" ? "Seller disclosure" : "Buyer disclosure";
  return (
    <div className={`rounded-lg border p-3 ${signed ? "border-sage/40 bg-sage/5" : "border-amber/40 bg-amber/5"}`}>
      <label className="flex items-center gap-2 font-semibold">
        <input type="checkbox" name={`${side}_disclosure_signed`} checked={signed} onChange={(e) => setSigned(e.target.checked)} className="check mt-0" />
        {label} signed
      </label>
      <p className="mt-1 text-xs text-ink-soft">{rule}</p>
      <div className="mt-2 grid gap-2">
        <input name={`${side}_disclosure_date`} type="date" className="input" defaultValue={date} aria-label={`${label} date`} />
        <input name={`${side}_disclosure_file`} type="file" accept="application/pdf,image/jpeg,image/png,image/heic" className="block w-full text-xs" aria-label={`${label} signed copy`} />
        {hasFile && dealId && <Link href={`/api/files/disclosure/${dealId}/${side}`} target="_blank" className="text-xs font-semibold underline">View signed copy</Link>}
        {!hasFile && <p className="text-xs text-ink-soft">Upload the signed copy (PDF or photo, up to 4 MB).</p>}
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-4 sm:p-5">
      <h2 className="mb-3 text-sm font-bold tracking-wide text-ink-soft uppercase">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </section>
  );
}

function F({ label, name, d, type = "text", required, wide }: { label: string; name: string; d: string; type?: string; required?: boolean; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} className="input" defaultValue={d} required={required} />
    </div>
  );
}

function Sel({ label, name, d, options, onChange, noEmpty }: {
  label: string; name: string; d: string; options: readonly (string | [string, string])[]; onChange?: (v: string) => void; noEmpty?: boolean;
}) {
  const opts = options.map((o) => (Array.isArray(o) ? o : [o, o]));
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <select id={name} name={name} className="input" defaultValue={d} onChange={onChange ? (e) => onChange(e.target.value) : undefined}>
        {!noEmpty && <option value="">—</option>}
        {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}
