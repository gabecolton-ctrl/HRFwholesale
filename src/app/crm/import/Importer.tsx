"use client";

import Papa from "papaparse";
import Link from "next/link";
import { useMemo, useState } from "react";
import { importRows, type ImportResult } from "./actions";
import { BUYER_FIELDS, LEAD_FIELDS, autoMap } from "@/lib/import-fields";
import { LEAD_SOURCES } from "@/lib/constants";

type Kind = "leads" | "buyers";
const CHUNK = 250;

export function Importer({ initialKind }: { initialKind: Kind }) {
  const [kind, setKind] = useState<Kind>(initialKind);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [data, setData] = useState<Record<string, string>[]>([]);
  const [map, setMap] = useState<Record<string, string>>({});
  const [source, setSource] = useState<string>("PropStream");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const fields = kind === "leads" ? LEAD_FIELDS : BUYER_FIELDS;
  const nameOk = kind === "leads"
    ? Boolean(map.seller_name || map.first_name || map.last_name)
    : Boolean(map.name || map.first_name || map.last_name || map.company);
  const addrOk = kind === "buyers" || Boolean(map.address);
  const ready = data.length > 0 && nameOk && addrOk;

  const mapped = useMemo(
    () => data.map((r) => Object.fromEntries(Object.entries(map).filter(([, h]) => h).map(([k, h]) => [k, r[h] ?? ""]))),
    [data, map],
  );

  function onFile(f: File | undefined) {
    setResult(null);
    setParseError(null);
    if (!f) return;
    setFileName(f.name);
    Papa.parse<Record<string, string>>(f, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
      complete: (out) => {
        const hs = (out.meta.fields ?? []).filter(Boolean);
        if (hs.length === 0) return setParseError("Couldn't find a header row. The first row should hold column names.");
        setHeaders(hs);
        setData(out.data);
        setMap(autoMap(hs, kind === "leads" ? LEAD_FIELDS : BUYER_FIELDS));
      },
      error: (e) => setParseError(e.message),
    });
  }

  async function run() {
    setBusy(true);
    setProgress(0);
    const total: ImportResult = { inserted: 0, skipped: 0, failed: [] };
    try {
      for (let i = 0; i < mapped.length; i += CHUNK) {
        const r = await importRows(kind, mapped.slice(i, i + CHUNK), i, kind === "leads" ? source || null : null);
        total.inserted += r.inserted;
        total.skipped += r.skipped;
        total.failed.push(...r.failed);
        setProgress(Math.min(mapped.length, i + CHUNK));
      }
    } catch (e) {
      total.failed.push({ row: 0, reason: (e as Error).message });
    }
    setResult(total);
    setBusy(false);
  }

  return (
    <div className="space-y-5">
      <section className="card space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap gap-2">
          {(["leads", "buyers"] as Kind[]).map((k) => (
            <button key={k} type="button" onClick={() => { setKind(k); setMap(autoMap(headers, k === "leads" ? LEAD_FIELDS : BUYER_FIELDS)); setResult(null); }}
              className={`btn btn-sm ${kind === k ? "btn-dark" : "btn-ghost"}`}>
              {k === "leads" ? "Seller leads" : "Cash buyers"}
            </button>
          ))}
        </div>
        <div>
          <label className="label" htmlFor="csv">CSV file</label>
          <input id="csv" type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])}
            className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-ink file:px-4 file:font-semibold file:text-white" />
          <p className="hint">From PropStream, or save a workbook tab (Lead Tracker / Cash Buyers) as CSV: File → Save As → CSV.</p>
        </div>
        {parseError && <p className="text-sm font-semibold text-danger">{parseError}</p>}
        {data.length > 0 && <p className="text-sm"><strong>{fileName}</strong>: {data.length.toLocaleString()} rows, {headers.length} columns.</p>}
      </section>

      {data.length > 0 && (
        <section className="card p-4 sm:p-5">
          <h2 className="font-semibold">Match your columns</h2>
          <p className="text-sm text-ink-soft">We guessed where we could. Anything left on “Skip” won't be imported.</p>
          {kind === "leads" && (
            <div className="mt-4 max-w-sm">
              <label className="label" htmlFor="src">Lead source for rows without one</label>
              <select id="src" className="input" value={source} onChange={(e) => setSource(e.target.value)}>
                <option value="">(leave blank)</option>
                {LEAD_SOURCES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fields.map((f) => (
              <div key={f.key}>
                <label className="label text-xs" htmlFor={`m-${f.key}`}>{f.label}{f.required && <span className="text-clay"> *</span>}</label>
                <select id={`m-${f.key}`} className={`input ${map[f.key] ? "border-sage" : ""}`} value={map[f.key] ?? ""}
                  onChange={(e) => setMap({ ...map, [f.key]: e.target.value })}>
                  <option value="">Skip</option>
                  {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>
          {!nameOk && <p className="mt-3 text-sm font-semibold text-danger">Map a name column (or first + last name).</p>}
          {!addrOk && <p className="mt-1 text-sm font-semibold text-danger">Map the property address column.</p>}
        </section>
      )}

      {ready && (
        <section className="card p-4 sm:p-5">
          <h2 className="font-semibold">Preview (first 5 rows)</h2>
          <div className="table-wrap mt-3">
            <table className="data">
              <thead><tr>{Object.keys(mapped[0] ?? {}).map((k) => <th key={k}>{fields.find((f) => f.key === k)?.label ?? k}</th>)}</tr></thead>
              <tbody>{mapped.slice(0, 5).map((r, i) => <tr key={i}>{Object.values(r).map((v, j) => <td key={j} className="max-w-48 truncate">{v}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-ink-soft">
            {kind === "leads" ? "Addresses already in the CRM are skipped. New leads get a day-3 follow-up unless the file has a date." : "Buyers whose email or phone is already in the CRM are skipped."}
          </p>
          <button type="button" className="btn btn-primary mt-4" onClick={run} disabled={busy}>
            {busy ? `Importing… ${progress.toLocaleString()} / ${mapped.length.toLocaleString()}` : `Import ${mapped.length.toLocaleString()} rows`}
          </button>
        </section>
      )}

      {result && (
        <section className="card p-4 sm:p-5" role="status">
          <h2 className="font-semibold">Import finished</h2>
          <p className="mt-2 text-sm"><strong className="text-sage">{result.inserted.toLocaleString()} added</strong> · {result.skipped.toLocaleString()} skipped as duplicates · {result.failed.length} with problems</p>
          {result.failed.length > 0 && (
            <ul className="mt-3 max-h-60 overflow-auto text-sm text-danger">
              {result.failed.slice(0, 200).map((f, i) => <li key={i}>{f.row ? `Row ${f.row}: ` : ""}{f.reason}</li>)}
            </ul>
          )}
          <Link href={kind === "leads" ? "/crm/leads" : "/crm/buyers"} className="btn btn-dark btn-sm mt-4">View {kind}</Link>
        </section>
      )}
    </div>
  );
}
