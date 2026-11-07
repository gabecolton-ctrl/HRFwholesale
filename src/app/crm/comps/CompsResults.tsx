"use client";

import { useMemo, useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { REHAB_LEVELS } from "@/lib/constants";
import type { CompsResult } from "@/lib/rentcast";
import { pullComps, useCompsOnLead } from "./actions";

const num = (s: string | number | null | undefined) => {
  if (s === null || s === undefined || s === "") return null;
  const n = Number(String(s).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
};
const usd = (n: number | null) => (n === null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }));
const round1k = (n: number) => Math.round(n / 1000) * 1000;

type Cond = "" | "updated" | "average" | "needs";

type Props = {
  lookupId: string;
  pulledAt: string;
  address: string;
  radius: string;
  result: CompsResult;
  rates: Record<string, number>;
  pct: number;
  fee: number;
  price: number | null;
  leadId?: string;
  canSendToLead: boolean;
};

/** Playbook rules: off market (likely sold), within ½ mile, last 6 months, size within 20%. */
function check(c: CompsResult["comps"][number], subjectSqft: number | null) {
  const why: string[] = [];
  const dist = num(c.distance.replace(/[^\d.]/g, ""));
  const sq = num(c.sqft);
  if (c.status === "Active") why.push("still for sale");
  if (dist !== null && dist > 0.5) why.push(`${dist.toFixed(1)} mi away`);
  if (c.days_old !== null && c.days_old > 180) why.push(`${Math.round(c.days_old / 30)} mo old`);
  if (subjectSqft && sq) {
    const off = Math.abs(sq - subjectSqft) / subjectSqft;
    if (off > 0.2) why.push(`size ${sq > subjectSqft ? "+" : "−"}${Math.round(off * 100)}%`);
  }
  if (!num(c.sold_price) || !sq) why.push("missing price or sq ft");
  return why;
}

export function CompsResults(p: Props) {
  const { result } = p;
  const [sqft, setSqft] = useState(result.subject.sqft ? String(result.subject.sqft) : "");
  const subj = num(sqft);

  const rows = useMemo(
    () =>
      result.comps
        .map((c, i) => ({ c, i, why: check(c, subj) }))
        .sort((a, b) => a.why.length - b.why.length || (num(a.c.distance.replace(/[^\d.]/g, "")) ?? 9) - (num(b.c.distance.replace(/[^\d.]/g, "")) ?? 9)),
    [result.comps, subj],
  );
  const [picked, setPicked] = useState<Set<number>>(() => new Set(rows.filter((r) => r.why.length === 0).map((r) => r.i)));
  const toggle = (i: number) => setPicked((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; });

  // Condition you judged from the photos. ARV comes only from Updated comps; as-is value from the rest.
  const [cond, setCond] = useState<Record<number, Cond>>({});
  const [haircut, setHaircut] = useState("5");
  const cut = 1 - Math.min(Math.max(num(haircut) ?? 0, 0), 30) / 100;

  const stats = (keep: (i: number) => boolean) => {
    const ppsf = result.comps
      .map((c, i) => ({ i, p: num(c.sold_price), s: num(c.sqft) }))
      .filter((x) => picked.has(x.i) && keep(x.i) && x.p && x.s)
      .map((x) => ((x.p as number) / (x.s as number)) * cut);
    if (!ppsf.length || !subj) return null;
    const avg = ppsf.reduce((a, b) => a + b, 0) / ppsf.length;
    return { n: ppsf.length, ppsf: avg, value: round1k(avg * subj), low: round1k(Math.min(...ppsf) * subj), high: round1k(Math.max(...ppsf) * subj) };
  };
  const updated = stats((i) => cond[i] === "updated");
  const arv = updated ?? stats((i) => cond[i] !== "needs");
  const arvIsEstimate = !updated;
  const asIs = stats((i) => cond[i] === "average" || cond[i] === "needs");

  const [rehab, setRehab] = useState("Medium");
  const [price, setPrice] = useState(p.price ? String(p.price) : "");
  const repairs = subj && p.rates[rehab] ? Math.round(subj * p.rates[rehab]) : null;
  const mao = arv ? Math.round(arv.value * (p.pct / 100) - (repairs ?? 0) - p.fee) : null;
  const pr = num(price);
  const verdict = mao === null || pr === null ? null : pr <= mao ? "GO" : "PASS";

  const pickedComps = result.comps.map((c, i) => ({ ...c, condition: cond[i] ?? "" })).filter((_, i) => picked.has(i));
  const s = result.subject;
  const facts = [s.beds && `${s.beds} bd`, s.baths && `${s.baths} ba`, s.year_built && `built ${s.year_built}`, s.property_type].filter(Boolean).join(" · ");

  return (
    <div className="space-y-5">
      {/* Subject */}
      <section className="card grid gap-4 p-4 sm:grid-cols-[1fr_auto] sm:p-5">
        <div>
          <p className="text-xs font-bold tracking-wide text-ink-soft uppercase">Subject property</p>
          <h2 className="h-display mt-1 text-xl font-semibold">{s.address || p.address}</h2>
          <p className="text-sm text-ink-soft">{facts || "No public records found for beds/baths."}</p>
          {s.last_sale_date && <p className="mt-1 text-sm text-ink-soft">Last sold {s.last_sale_date}{s.last_sale_price ? ` for ${usd(s.last_sale_price)}` : ""}</p>}
          <p className="mt-1 text-xs text-ink-soft">Pulled {new Date(p.pulledAt).toLocaleDateString("en-US")} · within {p.radius} mi · {result.comps.length} homes found</p>
        </div>
        <div className="sm:w-40">
          <label className="label" htmlFor="subj_sqft">Subject sq ft</label>
          <input id="subj_sqft" className="input" inputMode="numeric" value={sqft} onChange={(e) => setSqft(e.target.value)} placeholder="1450" />
          {!subj && <p className="hint text-danger">Enter sq ft to get an ARV.</p>}
        </div>
      </section>

      {/* Answer */}
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs font-semibold text-ink-soft">
            {arvIsEstimate ? `ARV estimate (${arv?.n ?? 0} comp${arv?.n === 1 ? "" : "s"}, none marked Updated)` : `ARV (from ${arv?.n} Updated comp${arv?.n === 1 ? "" : "s"})`}
          </p>
          <p className="h-display mt-1 text-3xl font-semibold">{usd(arv?.value ?? null)}</p>
          <p className="text-xs text-ink-soft">{arv ? `${usd(Math.round(arv.ppsf))}/sq ft · range ${usd(arv.low)}–${usd(arv.high)}` : "Check at least one comp below."}</p>
          {arvIsEstimate && arv && <p className="mt-1 text-xs font-semibold text-amber">Mark the renovated comps “Updated” below for a true ARV.</p>}
          <p className="mt-2 border-t border-line pt-2 text-xs text-ink-soft">
            As-is value: <b className="text-ink">{usd(asIs?.value ?? null)}</b>{asIs ? ` (${asIs.n} Average/Needs-work comp${asIs.n === 1 ? "" : "s"})` : " (mark some comps Average or Needs work)"}
          </p>
          <label className="mt-1 flex items-center gap-1.5 text-xs text-ink-soft">
            Take off
            <input className="input w-12 px-1.5 py-0.5 text-xs" inputMode="numeric" value={haircut} onChange={(e) => setHaircut(e.target.value)} aria-label="Percent to take off list prices" />
            % (list price → likely sold price)
          </label>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold text-ink-soft">Repairs ({rehab}, ${p.rates[rehab]}/sq ft)</p>
          <p className="h-display mt-1 text-3xl font-semibold">{usd(repairs)}</p>
          <select aria-label="Rehab level" className="input mt-1 py-1 text-sm" value={rehab} onChange={(e) => setRehab(e.target.value)}>
            {REHAB_LEVELS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className={`card p-4 ${verdict === "GO" ? "border-sage" : verdict === "PASS" ? "border-danger" : ""}`}>
          <p className="text-xs font-semibold text-ink-soft">Max offer (MAO) at {p.pct}% − {usd(p.fee)} fee</p>
          <p className="h-display mt-1 text-3xl font-semibold">{usd(mao)}</p>
          <div className="mt-1 flex items-center gap-2">
            <input aria-label="Seller's price" className="input py-1 text-sm" inputMode="numeric" placeholder="Seller's price" value={price} onChange={(e) => setPrice(e.target.value)} />
            {verdict && <span className={`shrink-0 rounded-md px-2 py-1 text-sm font-bold text-white ${verdict === "GO" ? "bg-sage" : "bg-danger"}`}>{verdict}</span>}
          </div>
        </div>
      </section>

      <p className="rounded-lg border border-amber/40 bg-amber/10 p-3 text-sm">
        <b>Heads up:</b> Texas doesn&apos;t make sold prices public, so these are <b>last list prices</b>. “Off market” homes most likely sold, often for a bit less than list.
        Use this to screen deals fast. Before you sign a contract, have an agent or title company confirm with real MLS solds.
      </p>

      {/* Comps table */}
      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold tracking-wide text-ink-soft uppercase">Nearby homes ({picked.size} checked)</h2>
          <p className="text-xs text-ink-soft">Auto-checked: off market, within ½ mi, last 6 months, size within 20%.</p>
        </div>
        {rows.length === 0 ? (
          <p className="card p-4 text-sm text-ink-soft">No comparable homes came back. Try 2 miles, or check the address.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th className="w-8"><span className="sr-only">Use</span></th><th>Address</th><th>Condition</th><th className="text-right">Price</th><th className="text-right">$/sq ft</th><th className="text-right">Sq ft</th><th>Bd/Ba</th><th className="text-right">Distance</th><th>Status</th><th>Date</th><th></th></tr>
              </thead>
              <tbody>
                {rows.map(({ c, i, why }) => {
                  const pp = num(c.sold_price), sq = num(c.sqft);
                  return (
                    <tr key={i} className={picked.has(i) ? "" : "text-ink-soft"}>
                      <td><input type="checkbox" className="check" checked={picked.has(i)} onChange={() => toggle(i)} aria-label={`Use ${c.address}`} /></td>
                      <td className="min-w-48">
                        <span className="font-medium text-ink">{c.address}</span>
                        {why.length > 0 && <span className="block text-xs">{why.join(" · ")}</span>}
                      </td>
                      <td>
                        <select
                          aria-label={`Condition of ${c.address}`}
                          className={`input w-32 px-2 py-1 text-xs ${cond[i] === "updated" ? "border-sage font-semibold text-sage" : cond[i] === "needs" ? "border-danger text-danger" : ""}`}
                          value={cond[i] ?? ""}
                          onChange={(e) => {
                            const v = e.target.value as Cond;
                            setCond((m) => ({ ...m, [i]: v }));
                            if (v && !picked.has(i)) toggle(i);
                          }}
                        >
                          <option value="">Not rated</option>
                          <option value="updated">Updated</option>
                          <option value="average">Average</option>
                          <option value="needs">Needs work</option>
                        </select>
                      </td>
                      <td className="text-right tabular-nums">{usd(pp)}</td>
                      <td className="text-right tabular-nums">{pp && sq ? usd(Math.round(pp / sq)) : "—"}</td>
                      <td className="text-right tabular-nums">{sq ? sq.toLocaleString() : "—"}</td>
                      <td className="whitespace-nowrap">{c.beds || "—"}/{c.baths || "—"}</td>
                      <td className="text-right whitespace-nowrap tabular-nums">{c.distance || "—"}</td>
                      <td className="whitespace-nowrap">{c.status === "Inactive" ? "Off market" : c.status === "Active" ? "For sale" : c.status || "—"}</td>
                      <td className="whitespace-nowrap">{c.sold_date || "—"}</td>
                      <td><a className="underline" href={`https://www.google.com/search?q=${encodeURIComponent(c.address)}`} target="_blank" rel="noreferrer">Photos</a></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="hint mt-2">Tap “Photos” and rate each comp. <b>Updated</b> = looks like a finished flip (new floors, kitchen, paint); these set your ARV. <b>Average</b> = livable but dated. <b>Needs work</b> = a fixer. Those two set the as-is value, which helps when you talk price with the seller. Three Updated comps beat ten unrated ones.</p>
      </section>

      {/* Actions */}
      <section className="flex flex-wrap items-center gap-3">
        {p.leadId ? (
          <form action={useCompsOnLead}>
            <input type="hidden" name="lead_id" value={p.leadId} />
            <input type="hidden" name="lookup_id" value={p.lookupId} />
            <input type="hidden" name="arv" value={arv?.value ?? ""} />
            <input type="hidden" name="sqft" value={subj ?? ""} />
            <input type="hidden" name="comps_json" value={JSON.stringify(pickedComps)} />
            <SubmitButton pendingText="Saving…" className="btn btn-primary">Send to Deal Analyzer</SubmitButton>
          </form>
        ) : (
          p.canSendToLead && <p className="text-sm text-ink-soft">To save these comps to a lead, open the lead and tap <b>Pull comps</b>.</p>
        )}
        <form action={pullComps}>
          <input type="hidden" name="address" value={p.address} />
          <input type="hidden" name="radius" value={p.radius} />
          <input type="hidden" name="refresh" value="1" />
          {p.leadId && <input type="hidden" name="lead_id" value={p.leadId} />}
          <SubmitButton pendingText="Pulling…" className="btn btn-ghost">Pull fresh (uses 1 lookup)</SubmitButton>
        </form>
      </section>
    </div>
  );
}
