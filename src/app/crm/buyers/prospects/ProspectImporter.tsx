"use client";

import Papa from "papaparse";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { buildProspects, type Prospect } from "@/lib/prospects";
import { saveProspects } from "./actions";

type Summary = { rows: number; prospects: number; skipped: number; active: number; saved: number; missing: string[]; error?: string };

async function readFile(f: File): Promise<{ headers: string[]; rows: Record<string, unknown>[] }> {
  const name = f.name.toLowerCase();
  if (name.endsWith(".xlsx")) {
    const { readSheet } = await import("read-excel-file/universal");
    const sheet = (await readSheet(f)) as unknown[][];
    const headerIdx = sheet.findIndex((r) => r.filter((c) => c !== null && String(c).trim()).length >= 3);
    if (headerIdx < 0) throw new Error("Couldn't find a header row in the spreadsheet.");
    const headers = (sheet[headerIdx] as unknown[]).map((c) => String(c ?? "").trim());
    const rows = sheet.slice(headerIdx + 1).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] instanceof Date ? r[i] : r[i] == null ? "" : String(r[i])])));
    return { headers: headers.filter(Boolean), rows };
  }
  if (name.endsWith(".xls")) throw new Error("Old .xls files can't be read here. In PropStream export as CSV, or open the file in Excel and Save As .xlsx.");
  return new Promise((resolve, reject) =>
    Papa.parse<Record<string, string>>(f, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
      complete: (out) => resolve({ headers: (out.meta.fields ?? []).filter(Boolean), rows: out.data }),
      error: (e) => reject(e),
    }),
  );
}

export function ProspectImporter() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);

  async function onFile(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    setSummary(null);
    try {
      setProgress("Reading the file…");
      const { headers, rows } = await readFile(f);
      const { prospects, skipped, columns } = buildProspects(rows, headers);
      const missing = [
        !columns.full && !columns.first && !columns.last && "owner name",
        !columns.date && "sale date",
        !columns.price && "sale price",
        !columns.zip && "property ZIP",
        columns.phoneCols.length === 0 && "phone numbers (skip trace the list in PropStream first)",
      ].filter(Boolean) as string[];
      if (!columns.full && !columns.first && !columns.last) throw new Error("Couldn't find an owner name column. Make sure the export includes owner names.");
      let saved = 0;
      for (let i = 0; i < prospects.length; i += 100) {
        setProgress(`Saving ${Math.min(prospects.length, i + 100)} of ${prospects.length} buyers…`);
        const r = await saveProspects(prospects.slice(i, i + 100) as Prospect[], f.name);
        if (r.error) throw new Error(r.error);
        saved += r.saved;
      }
      setSummary({ rows: rows.length, prospects: prospects.length, skipped, active: prospects.filter((p) => p.purchases_12mo > 0).length, saved, missing });
      router.refresh();
    } catch (e) {
      setSummary({ rows: 0, prospects: 0, skipped: 0, active: 0, saved: 0, missing: [], error: (e as Error).message });
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  return (
    <section className="card p-4 sm:p-5">
      <h2 className="font-semibold">Import a PropStream export</h2>
      <p className="mt-1 text-sm text-ink-soft">
        In PropStream, filter for <b>cash buyers</b> (e.g. Cash Buyer + last sale in the past 12 months, investor/corporate owners) in your areas,
        skip trace the list, then export. Upload the .xlsx or .csv here. Each owner is grouped across all the houses they bought, then scored.
      </p>
      <label className={`btn btn-primary mt-3 ${busy ? "pointer-events-none opacity-60" : ""}`}>
        {busy ? progress || "Working…" : "Choose file (.xlsx or .csv)"}
        <input type="file" accept=".xlsx,.csv,.xls" className="sr-only" disabled={busy} onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
      {summary?.error && <p className="mt-3 rounded-lg bg-danger/5 px-3 py-2 text-sm text-danger">{summary.error}</p>}
      {summary && !summary.error && (
        <div className="mt-3 rounded-lg bg-sage/10 px-3 py-2 text-sm">
          <p><b>{summary.rows.toLocaleString()}</b> rows → <b>{summary.prospects.toLocaleString()}</b> buyers ({summary.active.toLocaleString()} bought in the last 12 months). Saved {summary.saved.toLocaleString()}.{summary.skipped ? ` Skipped ${summary.skipped} rows with no owner name.` : ""}</p>
          {summary.missing.length > 0 && <p className="mt-1 text-amber">Not in this file: {summary.missing.join(", ")}. Scores will be lower without them.</p>}
        </div>
      )}
    </section>
  );
}
