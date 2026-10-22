"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CompsEditor } from "@/components/crm/CompsEditor";
import { SubmitButton } from "@/components/SubmitButton";
import { REHAB_LEVELS } from "@/lib/constants";
import { saveAnalysis } from "./actions";

type Rates = Record<string, number>;
type Init = { arv?: string; repairs?: string; sqft?: string; price?: string; pct: string; fee: string; rehab?: string; comps?: unknown };

const num = (s: string) => {
  const n = Number(String(s).replace(/[$,%\s]/g, ""));
  return s !== "" && Number.isFinite(n) ? n : null;
};
const fmt = (n: number | null) => (n === null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }));

export function Analyzer({ init, rates, lead }: { init: Init; rates: Rates; lead?: { id: string; label: string } }) {
  const [arv, setArv] = useState(init.arv ?? "");
  const [sqft, setSqft] = useState(init.sqft ?? "");
  const [rehab, setRehab] = useState(init.rehab ?? "");
  const [repairs, setRepairs] = useState(init.repairs ?? "");
  const [pct, setPct] = useState(init.pct);
  const [fee, setFee] = useState(init.fee);
  const [price, setPrice] = useState(init.price ?? "");

  const suggested = useMemo(() => {
    const s = num(sqft);
    const r = rates[rehab];
    return s && r ? Math.round(s * r) : null;
  }, [sqft, rehab, rates]);

  const out = useMemo(() => {
    const a = num(arv), p = num(pct), f = num(fee) ?? 0, r = num(repairs) ?? 0, pr = num(price);
    if (a === null || p === null) return null;
    const mao = Math.round(a * (p / 100) - r - f);
    return {
      mao,
      verdict: pr === null ? null : pr <= mao ? "GO" : "PASS",
      gap: pr === null ? null : mao - pr,
      buyerPrice: Math.round(a * (p / 100) - r),          // what a buyer at this % would pay you
      buyerProfit: Math.round(a - (a * (p / 100) - r) - r), // ARV − buyer price − repairs
    };
  }, [arv, pct, fee, repairs, price]);

  return (
    <form action={saveAnalysis} className="grid gap-5 lg:grid-cols-[1fr_22rem]">
      {lead && <input type="hidden" name="lead_id" value={lead.id} />}
      <div className="space-y-5">
        <section className="card grid gap-4 p-4 sm:grid-cols-3 sm:p-5">
          <h2 className="col-span-full text-sm font-bold tracking-wide text-ink-soft uppercase">After-repair value</h2>
          <div><label className="label" htmlFor="arv">ARV</label><input id="arv" name="arv" className="input" inputMode="numeric" value={arv} onChange={(e) => setArv(e.target.value)} placeholder="210000" /></div>
          <div><label className="label" htmlFor="sqft">Subject sq ft</label><input id="sqft" name="sqft" className="input" inputMode="numeric" value={sqft} onChange={(e) => setSqft(e.target.value)} /></div>
          <div className="hidden sm:block" />
          <CompsEditor initial={init.comps} subjectSqft={sqft} onUseArv={setArv} />
        </section>

        <section className="card grid gap-4 p-4 sm:grid-cols-3 sm:p-5">
          <h2 className="col-span-full text-sm font-bold tracking-wide text-ink-soft uppercase">Repairs</h2>
          <div>
            <label className="label" htmlFor="rehab_level">Rehab level</label>
            <select id="rehab_level" name="rehab_level" className="input" value={rehab} onChange={(e) => setRehab(e.target.value)}>
              <option value="">—</option>
              {REHAB_LEVELS.map((r) => <option key={r} value={r}>{r} (${rates[r]}/sqft)</option>)}
            </select>
          </div>
          <div><label className="label" htmlFor="repairs">Repair estimate</label><input id="repairs" name="repairs" className="input" inputMode="numeric" value={repairs} onChange={(e) => setRepairs(e.target.value)} /></div>
          <div className="flex items-end">
            {suggested !== null && (
              <button type="button" className="btn btn-ghost btn-sm w-full" onClick={() => setRepairs(String(suggested))}>Use {fmt(suggested)} (sqft × rate)</button>
            )}
          </div>
          <p className="col-span-full hint">Be conservative. Walk major items (roof, foundation, HVAC, plumbing) with a contractor before you're confident.</p>
        </section>

        <section className="card grid gap-4 p-4 sm:grid-cols-3 sm:p-5">
          <h2 className="col-span-full text-sm font-bold tracking-wide text-ink-soft uppercase">Your numbers</h2>
          <div><label className="label" htmlFor="mao_pct">MAO %</label><input id="mao_pct" name="mao_pct" className="input" inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} /><p className="hint">70% to start; some DFW areas support 75–80%.</p></div>
          <div><label className="label" htmlFor="fee">Your fee</label><input id="fee" name="fee" className="input" inputMode="numeric" value={fee} onChange={(e) => setFee(e.target.value)} /></div>
          <div><label className="label" htmlFor="price">Asking / contract price</label><input id="price" name="price" className="input" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
        </section>
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <section className={`card p-5 ${out?.verdict === "GO" ? "border-sage" : out?.verdict === "PASS" ? "border-danger" : ""}`}>
          <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Maximum allowable offer</p>
          <p className="h-display mt-1 text-4xl font-semibold">{fmt(out?.mao ?? null)}</p>
          <p className="mt-1 text-xs text-ink-soft">ARV × {pct || "?"}% − repairs − fee</p>
          {out?.verdict && (
            <div className={`mt-4 rounded-lg p-3 text-center ${out.verdict === "GO" ? "bg-sage text-white" : "bg-danger text-white"}`}>
              <p className="h-display text-3xl font-bold">{out.verdict}</p>
              <p className="text-sm">{out.verdict === "GO" ? `${fmt(out.gap)} under MAO` : `${fmt(Math.abs(out.gap ?? 0))} over MAO: pass or renegotiate`}</p>
            </div>
          )}
          {out && (
            <dl className="mt-4 grid grid-cols-2 gap-y-1 text-sm">
              <dt className="text-ink-soft">Buyer pays you</dt><dd className="text-right">{fmt(out.buyerPrice)}</dd>
              <dt className="text-ink-soft">Buyer's margin (before costs)</dt><dd className="text-right">{fmt(out.buyerProfit)}</dd>
            </dl>
          )}
          {lead ? (
            <div className="mt-5 space-y-3 border-t border-line pt-4">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="set_offer" className="check mt-0" /> Also set the lead's offer amount to MAO</label>
              <SubmitButton className="btn btn-primary w-full">Save to {lead.label}</SubmitButton>
            </div>
          ) : (
            <p className="mt-5 border-t border-line pt-4 text-xs text-ink-soft">
              To save an analysis, open it from a lead (<Link className="underline" href="/crm/leads">Leads</Link> → a lead → Analyze).
            </p>
          )}
        </section>
      </aside>
    </form>
  );
}
