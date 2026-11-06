import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Pulls new records from a city's open-data portal (Socrata, used by Dallas, Fort Worth, Austin,
 * Chicago, Seattle and many more) into the distress inbox. Column names differ by city, so we
 * detect the address / type / date / zip / id columns from the dataset's metadata.
 */

export type Feed = {
  id: string;
  name: string;
  city: string;
  state: string;
  domain: string;
  dataset_id: string;
  keywords: string[];
  field_address: string | null;
  field_type: string | null;
  field_date: string | null;
  field_zip: string | null;
  field_id: string | null;
  last_pulled_at: string | null;
};

type Col = { fieldName: string; name: string; dataTypeName: string };
type Fields = { address: string | null; type: string | null; date: string | null; zip: string | null; id: string | null };

const PATTERNS: Record<keyof Fields, RegExp[]> = {
  address: [/^(incident_|street_|service_|location_|property_|site_)?address$/, /address/, /^location$/, /addr/],
  type: [/service_request_type/, /^(sr|request|case|violation|complaint|problem)_?type/, /type_desc/, /^type$/, /violation/, /problem/, /complaint/, /category/, /description/],
  date: [/^created_date$/, /created/, /open(ed)?_date/, /date_received|received/, /reported|report_date/, /^date$/, /date/],
  zip: [/^zip(_code)?$/, /zip/, /postal/],
  id: [/service_request_(number|id)/, /^(sr|request|case|ticket)_?(number|id|no)$/, /^id$/, /number$/],
};

function pick(cols: Col[], key: keyof Fields): string | null {
  const usable = cols.filter((c) => !c.fieldName.startsWith(":") && !c.fieldName.startsWith("@"));
  const ok = (c: Col) =>
    key === "date" ? /date|calendar/i.test(c.dataTypeName) : key === "address" ? /text|location|point/i.test(c.dataTypeName) : true;
  for (const re of PATTERNS[key]) {
    const hit = usable.find((c) => re.test(c.fieldName.toLowerCase()) && ok(c));
    if (hit) return hit.fieldName;
  }
  return null;
}

const base = (domain: string) => `${process.env.SOCRATA_SCHEME ?? "https"}://${domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "")}`;
const headers = () => {
  const h: Record<string, string> = { Accept: "application/json" };
  if (process.env.SOCRATA_APP_TOKEN) h["X-App-Token"] = process.env.SOCRATA_APP_TOKEN;
  return h;
};

export async function detectFields(domain: string, dataset: string): Promise<Fields> {
  const res = await fetch(`${base(domain)}/api/views/${dataset}.json`, { headers: headers(), cache: "no-store", signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Couldn't read that dataset (${res.status}). Check the website and dataset ID.`);
  const meta = (await res.json()) as { columns?: Col[] };
  const cols = meta.columns ?? [];
  return { address: pick(cols, "address"), type: pick(cols, "type"), date: pick(cols, "date"), zip: pick(cols, "zip"), id: pick(cols, "id") };
}

/** Socrata "location" values come as objects; pull a street address out of whatever shape we get. */
function addressOf(v: unknown): { address: string; city?: string; zip?: string } {
  if (v == null) return { address: "" };
  if (typeof v === "string") return { address: v.trim() };
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.human_address === "string") {
      try {
        const h = JSON.parse(o.human_address) as Record<string, string>;
        return { address: (h.address ?? "").trim(), city: h.city, zip: h.zip };
      } catch {}
    }
    if (typeof o.address === "string") return { address: o.address.trim(), city: o.city as string | undefined, zip: o.zip as string | undefined };
  }
  return { address: "" };
}

const fmtFloating = (d: Date) => d.toISOString().slice(0, 19);

export async function pullFeed(db: SupabaseClient, feed: Feed): Promise<{ added: number; scanned: number }> {
  try {
    let f: Fields = { address: feed.field_address, type: feed.field_type, date: feed.field_date, zip: feed.field_zip, id: feed.field_id };
    if (!f.address || !f.date) {
      const d = await detectFields(feed.domain, feed.dataset_id);
      f = { address: f.address ?? d.address, type: f.type ?? d.type, date: f.date ?? d.date, zip: f.zip ?? d.zip, id: f.id ?? d.id };
      await db.from("signal_feeds").update({ field_address: f.address, field_type: f.type, field_date: f.date, field_zip: f.zip, field_id: f.id }).eq("id", feed.id);
    }
    if (!f.address || !f.date) throw new Error("Couldn't find the address or date column in this dataset. Set them under Advanced.");

    // Look back 2 days past the last pull (portals often post records late); 14 days the first time.
    const since = feed.last_pulled_at ? new Date(new Date(feed.last_pulled_at).getTime() - 2 * 86_400_000) : new Date(Date.now() - 14 * 86_400_000);
    const kw = feed.keywords.map((k) => k.trim().toLowerCase()).filter(Boolean);
    const q = new URLSearchParams({ $limit: "2000", $order: `${f.date} DESC`, $where: `${f.date} > '${fmtFloating(since)}'` });
    // Keywords keep matching types; a keyword starting with "-" throws matching types out (e.g. "-sign").
    const esc = (k: string) => k.replace(/'/g, "''");
    const inc = kw.filter((k) => !k.startsWith("-"));
    const exc = kw.filter((k) => k.startsWith("-")).map((k) => k.slice(1).trim()).filter(Boolean);
    if (inc.length && f.type) {
      const ors = inc.map((k) => `lower(${f.type}) like '%${esc(k)}%'`).join(" OR ");
      q.set("$where", `${q.get("$where")} AND (${ors})`);
    }
    if (exc.length && f.type) {
      q.set("$where", `${q.get("$where")} AND ${exc.map((k) => `lower(${f.type}) not like '%${esc(k)}%'`).join(" AND ")}`);
    }
    const res = await fetch(`${base(feed.domain)}/resource/${feed.dataset_id}.json?${q}`, { headers: headers(), cache: "no-store", signal: AbortSignal.timeout(25_000) });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`The city's data portal answered ${res.status}. ${t.slice(0, 160)}`);
    }
    const rows = (await res.json()) as Record<string, unknown>[];

    const signals = rows
      .map((r, i) => {
        const a = addressOf(r[f.address!]);
        // "742 SECRET LN, DALLAS, TX 75216" → street + city + zip
        const m = a.address.match(/^(.+?),\s*([^,]+?),\s*([A-Za-z]{2})\.?\s*(\d{5})?/);
        if (m) Object.assign(a, { address: m[1], city: a.city ?? m[2], zip: a.zip ?? m[4] });
        if (a.address === a.address.toUpperCase()) a.address = a.address.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase());
        if (a.city && a.city === a.city.toUpperCase()) a.city = a.city.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase());
        if (!a.address || !/^\d/.test(a.address.trim()) || /&| and /i.test(a.address)) return null; // skip intersections / blank addresses
        const zip = (f.zip ? String(r[f.zip] ?? "") : a.zip ?? "").replace(/\D/g, "").slice(0, 5) || null;
        const when = r[f.date!] ? new Date(String(r[f.date!])) : null;
        const type = f.type ? String(r[f.type] ?? "").trim() : "Code complaint";
        const sid = f.id && r[f.id] != null ? String(r[f.id]) : `${a.address}|${type}|${r[f.date!] ?? i}`;
        return {
          source: "feed",
          feed_id: feed.id,
          source_id: sid.slice(0, 300),
          signal_type: (type || "Code complaint").slice(0, 120),
          address: a.address.replace(/\s+/g, " ").slice(0, 200),
          city: a.city || feed.city,
          state: feed.state,
          zip,
          reported_at: when && !isNaN(when.getTime()) ? when.toISOString() : null,
          raw: r,
        };
      })
      .filter(Boolean) as Record<string, unknown>[];

    let added = 0;
    for (let i = 0; i < signals.length; i += 500) {
      const { data, error } = await db
        .from("distress_signals")
        .upsert(signals.slice(i, i + 500), { onConflict: "feed_id,source_id", ignoreDuplicates: true })
        .select("id");
      if (error) throw new Error(error.message);
      added += data?.length ?? 0;
    }
    await db.from("signal_feeds").update({ last_pulled_at: new Date().toISOString(), last_count: added, last_error: null }).eq("id", feed.id);
    return { added, scanned: rows.length };
  } catch (e) {
    await db.from("signal_feeds").update({ last_error: (e as Error).message.slice(0, 500) }).eq("id", feed.id);
    throw e;
  }
}

/** True if a complaint type passes the feed's keyword rules (same logic as the pull). */
export function typeMatches(keywords: string[], type: string) {
  const t = type.toLowerCase();
  const kw = keywords.map((k) => k.trim().toLowerCase()).filter(Boolean);
  const inc = kw.filter((k) => !k.startsWith("-"));
  const exc = kw.filter((k) => k.startsWith("-")).map((k) => k.slice(1).trim()).filter(Boolean);
  return (inc.length === 0 || inc.some((k) => t.includes(k))) && !exc.some((k) => t.includes(k));
}

/** Every complaint type the city logged in the last 30 days, most common first. Helps pick keywords. */
export async function feedTypes(feed: Feed): Promise<{ type: string; n: number }[]> {
  let f = { type: feed.field_type, date: feed.field_date };
  if (!f.type || !f.date) {
    const d = await detectFields(feed.domain, feed.dataset_id);
    f = { type: f.type ?? d.type, date: f.date ?? d.date };
  }
  if (!f.type || !f.date) throw new Error("Couldn't find the complaint type or date column for this dataset.");
  const since = fmtFloating(new Date(Date.now() - 30 * 86_400_000));
  const q = new URLSearchParams({ $select: `${f.type} as t, count(*) as n`, $where: `${f.date} > '${since}'`, $group: f.type, $order: "n DESC", $limit: "300" });
  const res = await fetch(`${base(feed.domain)}/resource/${feed.dataset_id}.json?${q}`, { headers: headers(), cache: "no-store", signal: AbortSignal.timeout(25_000) });
  if (!res.ok) throw new Error(`The city's data portal answered ${res.status}.`);
  const rows = (await res.json()) as { t?: string; n?: string }[];
  return rows.filter((r) => r.t).map((r) => ({ type: String(r.t), n: Number(r.n ?? 0) }));
}
