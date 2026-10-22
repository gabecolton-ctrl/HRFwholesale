"use server";

import { requireRole } from "@/lib/auth";
import { LEAD_STATUSES, PROPERTY_TYPES, REHAB_LEVELS, STRATEGIES } from "@/lib/constants";
import { addressKey, phoneDigits, toList, toNumber } from "@/lib/format";

export type ImportResult = { inserted: number; skipped: number; failed: { row: number; reason: string }[] };
type Row = Record<string, string>;

const yes = (v?: string) => /^(y|yes|true|1|x|✓)$/i.test((v ?? "").trim());
const text = (v?: string) => {
  const s = (v ?? "").trim();
  return s === "" ? null : s;
};

function parseDate(v?: string): string | null {
  const s = (v ?? "").trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** Matches loosely: "light rehab" → Light, "flip" → Flip, "SFR" → Single family. */
function matchList(v: string | undefined, allowed: readonly string[], extra: Record<string, string> = {}) {
  return [...new Set(
    toList(v ?? "")
      .map((x) => {
        const lx = x.toLowerCase();
        if (extra[lx]) return extra[lx];
        return allowed.find((a) => lx.includes(a.toLowerCase()) || a.toLowerCase().includes(lx));
      })
      .filter((x): x is string => Boolean(x)),
  )];
}

export async function importRows(kind: "leads" | "buyers", rows: Row[], startIndex: number, defaultSource: string | null): Promise<ImportResult> {
  const { supabase, user } = await requireRole("owner");
  if (!Array.isArray(rows) || rows.length > 500) throw new Error("Send at most 500 rows at a time");
  return kind === "leads" ? importLeads(supabase, user.id, rows, startIndex, defaultSource) : importBuyers(supabase, user.id, rows, startIndex);
}

type SB = Awaited<ReturnType<typeof requireRole>>["supabase"];

async function insertWithFallback(supabase: SB, table: string, batch: { idx: number; row: Record<string, unknown> }[], res: ImportResult) {
  if (batch.length === 0) return;
  const { error } = await supabase.from(table).insert(batch.map((b) => b.row));
  if (!error) {
    res.inserted += batch.length;
    return;
  }
  // Find the bad rows one at a time so good rows still go in.
  for (const b of batch) {
    const { error: e } = await supabase.from(table).insert(b.row);
    if (e) res.failed.push({ row: b.idx, reason: e.message });
    else res.inserted++;
  }
}

async function importLeads(supabase: SB, userId: string, rows: Row[], start: number, defaultSource: string | null): Promise<ImportResult> {
  const res: ImportResult = { inserted: 0, skipped: 0, failed: [] };
  const prepared: { idx: number; key: string; row: Record<string, unknown> }[] = [];

  rows.forEach((r, i) => {
    const idx = start + i + 2; // spreadsheet row number (header = row 1)
    const name = text(r.seller_name) ?? text([r.first_name, r.last_name].filter(Boolean).join(" "));
    const address = text(r.address);
    if (!name || !address) {
      res.failed.push({ row: idx, reason: "Missing seller name or address" });
      return;
    }
    const status = LEAD_STATUSES.find((s) => s.toLowerCase() === (r.status ?? "").trim().toLowerCase()) ?? "New";
    const mot = toNumber(r.motivation);
    const zip = text(r.zip)?.replace(/[^\d-]/g, "").slice(0, 10) ?? null;
    const row: Record<string, unknown> = {
      created_by: userId,
      seller_name: name,
      address,
      city: text(r.city),
      state: text(r.state)?.toUpperCase().slice(0, 2) ?? "TX",
      zip,
      county: text(r.county),
      phone: phoneDigits(r.phone) || null,
      email: text(r.email),
      mailing_address: text(r.mailing_address),
      property_type: text(r.property_type),
      beds: toNumber(r.beds),
      baths: toNumber(r.baths),
      sqft: toNumber(r.sqft) !== null ? Math.round(toNumber(r.sqft)!) : null,
      year_built: toNumber(r.year_built),
      condition: text(r.condition),
      occupancy: text(r.occupancy),
      reason_for_selling: text(r.reason_for_selling),
      timeline: text(r.timeline),
      asking_price: toNumber(r.asking_price),
      motivation: mot !== null ? Math.min(5, Math.max(1, Math.round(mot))) : null,
      lead_source: text(r.lead_source) ?? defaultSource,
      status,
      est_arv: toNumber(r.est_arv),
      est_repairs: toNumber(r.est_repairs),
      mortgage_balance: toNumber(r.mortgage_balance),
      offer_amount: toNumber(r.offer_amount),
      keep_candidate: yes(r.keep_candidate),
      do_not_call: yes(r.do_not_call),
      notes: text(r.notes),
    };
    const nf = parseDate(r.next_follow_up);
    if (nf) row.next_follow_up = nf;
    if (status === "Dead") row.dead_reason = "Imported as Dead";
    prepared.push({ idx, key: addressKey(address, zip), row });
  });

  // Skip addresses already in the CRM, and repeats within the file.
  const keys = [...new Set(prepared.map((p) => p.key))];
  const existing = new Set<string>();
  for (let i = 0; i < keys.length; i += 200) {
    const { data } = await supabase.from("leads").select("address_key").in("address_key", keys.slice(i, i + 200));
    (data ?? []).forEach((d) => existing.add(d.address_key));
  }
  const seen = new Set<string>();
  const batch = prepared.filter((p) => {
    if (existing.has(p.key) || seen.has(p.key)) {
      res.skipped++;
      return false;
    }
    seen.add(p.key);
    return true;
  });
  await insertWithFallback(supabase, "leads", batch, res);
  return res;
}

async function importBuyers(supabase: SB, userId: string, rows: Row[], start: number): Promise<ImportResult> {
  const res: ImportResult = { inserted: 0, skipped: 0, failed: [] };
  const { data: existingRows } = await supabase.from("cash_buyers").select("email,phone").limit(10000);
  const emails = new Set((existingRows ?? []).map((b) => (b.email ?? "").toLowerCase()).filter(Boolean));
  const phones = new Set((existingRows ?? []).map((b) => phoneDigits(b.phone)).filter(Boolean));

  const batch: { idx: number; row: Record<string, unknown> }[] = [];
  rows.forEach((r, i) => {
    const idx = start + i + 2;
    const name = text(r.name) ?? text([r.first_name, r.last_name].filter(Boolean).join(" ")) ?? text(r.company);
    if (!name) {
      res.failed.push({ row: idx, reason: "Missing name" });
      return;
    }
    const email = text(r.email)?.toLowerCase() ?? null;
    const phone = phoneDigits(r.phone) || null;
    if ((email && emails.has(email)) || (phone && phones.has(phone))) {
      res.skipped++;
      return;
    }
    if (email) emails.add(email);
    if (phone) phones.add(phone);
    let min = toNumber(r.price_min);
    let max = toNumber(r.price_max);
    if (min !== null && max !== null && min > max) [min, max] = [max, min];
    const tier = (r.tier ?? "").trim().toUpperCase();
    batch.push({
      idx,
      row: {
        created_by: userId,
        name,
        company: text(r.company),
        phone,
        email,
        areas: toList(r.areas),
        price_min: min,
        price_max: max,
        property_types: matchList(r.property_types, PROPERTY_TYPES, { sfr: "Single family", sfh: "Single family", "single-family": "Single family", mf: "Multifamily 5+" }),
        rehab_levels: matchList(r.rehab_levels, REHAB_LEVELS, { cosmetic: "Light", "full gut": "Heavy", gut: "Heavy", "move-in ready": "Turnkey" }),
        strategies: matchList(r.strategies, STRATEGIES, { "buy and hold": "Hold", rental: "Hold", brrrr: "Hold", "fix and flip": "Flip" }),
        tier: ["A", "B", "C"].includes(tier) ? tier : "B",
        source: text(r.source) ?? "Import",
        pof_verified: yes(r.pof_verified),
        notes: text(r.notes),
      },
    });
  });
  await insertWithFallback(supabase, "cash_buyers", batch, res);
  return res;
}
