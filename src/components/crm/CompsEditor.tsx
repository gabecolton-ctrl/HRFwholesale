"use client";

import { useMemo, useState } from "react";

export type Comp = { address: string; sold_price: string; sold_date: string; beds: string; baths: string; sqft: string; distance: string };
const blank: Comp = { address: "", sold_price: "", sold_date: "", beds: "", baths: "", sqft: "", distance: "" };
const num = (s: string) => {
  const n = Number(String(s).replace(/[$,\s]/g, ""));
  return s !== "" && Number.isFinite(n) ? n : null;
};
const fmt = (n: number | null) => (n === null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }));

/** Sold comps for the listing. Also suggests an ARV (playbook: 3 solds within 0.5 mi, last 6 months, ±20% size). */
export function CompsEditor({ initial, subjectSqft, onUseArv }: {
  initial: unknown;
  subjectSqft?: string;
  onUseArv?: (v: string) => void;
}) {
  const start: Comp[] = Array.isArray(initial)
    ? initial.map((c: Record<string, unknown>) => Object.fromEntries(Object.keys(blank).map((k) => [k, c?.[k] == null ? "" : String(c[k])])) as Comp)
    : [];
  const [rows, setRows] = useState<Comp[]>(start.length ? start : []);
  const set = (i: number, k: keyof Comp, v: string) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  const est = useMemo(() => {
    const priced = rows.map((r) => ({ p: num(r.sold_price), s: num(r.sqft) })).filter((r) => r.p);
    if (priced.length === 0) return null;
    const avg = priced.reduce((a, r) => a + (r.p ?? 0), 0) / priced.length;
    const per = priced.filter((r) => r.s).map((r) => (r.p ?? 0) / (r.s ?? 1));
    const subj = num(subjectSqft ?? "");
    const bySqft = per.length && subj ? (per.reduce((a, b) => a + b, 0) / per.length) * subj : null;
    return { avg, bySqft, ppsf: per.length ? per.reduce((a, b) => a + b, 0) / per.length : null, n: priced.length };
  }, [rows, subjectSqft]);

  return (
    <div className="col-span-full">
      <input type="hidden" name="comps_json" value={JSON.stringify(rows)} />
      <div className="mb-2 flex items-center justify-between">
        <p className="label mb-0">Sold comps (shown to buyers)</p>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRows([...rows, { ...blank }])} disabled={rows.length >= 10}>+ Add comp</button>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-soft">Add 3 sold comps: within 0.5 mile, sold in the last 6 months, similar size. Use solds, never listings.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 rounded-lg border border-line p-2 sm:grid-cols-[2fr_1fr_1fr_.6fr_.6fr_.8fr_.8fr_auto]">
              <input className="input col-span-2 sm:col-span-1" placeholder="Address" value={r.address} onChange={(e) => set(i, "address", e.target.value)} aria-label="Comp address" />
              <input className="input" placeholder="Sold $" inputMode="numeric" value={r.sold_price} onChange={(e) => set(i, "sold_price", e.target.value)} aria-label="Sold price" />
              <input className="input" type="date" value={r.sold_date} onChange={(e) => set(i, "sold_date", e.target.value)} aria-label="Sold date" />
              <input className="input" placeholder="Bd" value={r.beds} onChange={(e) => set(i, "beds", e.target.value)} aria-label="Beds" />
              <input className="input" placeholder="Ba" value={r.baths} onChange={(e) => set(i, "baths", e.target.value)} aria-label="Baths" />
              <input className="input" placeholder="Sqft" inputMode="numeric" value={r.sqft} onChange={(e) => set(i, "sqft", e.target.value)} aria-label="Sqft" />
              <input className="input" placeholder="0.3 mi" value={r.distance} onChange={(e) => set(i, "distance", e.target.value)} aria-label="Distance" />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="Remove comp">✕</button>
            </div>
          ))}
        </div>
      )}
      {est && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-paper p-3 text-sm">
          <span>Avg of {est.n} sold: <strong>{fmt(est.avg)}</strong></span>
          {est.ppsf && <span>· {fmt(est.ppsf)}/sqft</span>}
          {est.bySqft && <span>· × subject sqft = <strong>{fmt(est.bySqft)}</strong></span>}
          {onUseArv && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onUseArv(String(Math.round(est.bySqft ?? est.avg)))}>Use as ARV</button>
          )}
          {est.n < 3 && <span className="text-amber">Playbook: use at least 3 comps.</span>}
        </div>
      )}
    </div>
  );
}
