import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppSettings } from "@/lib/settings";
import { MONTHLY_LIMIT } from "@/lib/rentcast";

/**
 * Deal Scanner: pulls active single-family MLS listings for a city from RentCast, then vets them:
 *  - hard filters (size, HOA, not new construction)
 *  - seller-motivation signals (foreclosure/short sale, days on market, price cuts, relists)
 *  - price vs. similar listings in the same ZIP, and a quick ARV / max-offer check
 * Listings that pass the filters and score 40+ are "qualified".
 */

export type Market = {
  id: string; city: string; state: string; active: boolean;
  price_min: number; price_max: number; min_beds: number; last_scanned_at: string | null;
};

type Rc = Record<string, unknown>;
const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : v != null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null);
const s = (v: unknown) => (v == null ? "" : String(v).trim());

/** RentCast requests used this month (comps + scans share the same plan). */
export async function rentcastUsedThisMonth(db: SupabaseClient) {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const [{ count }, { data: runs }] = await Promise.all([
    db.from("comp_lookups").select("id", { count: "exact", head: true }).gte("created_at", start.toISOString()),
    db.from("scan_runs").select("requests").gte("created_at", start.toISOString()),
  ]);
  return (count ?? 0) + (runs ?? []).reduce((a, r) => a + Number(r.requests ?? 0), 0);
}

async function fetchPage(m: Market, offset: number): Promise<{ rows: Rc[]; total: number | null }> {
  const key = process.env.RENTCAST_API_KEY?.trim().replace(/^["']|["']$/g, "");
  if (!key) throw new Error("RentCast isn't connected. Add RENTCAST_API_KEY in Vercel.");
  const base = process.env.RENTCAST_BASE_URL ?? "https://api.rentcast.io/v1";
  const q = new URLSearchParams({
    city: m.city,
    state: m.state,
    status: "Active",
    propertyType: "Single Family",
    price: `${m.price_min}:${m.price_max}`,
    bedrooms: `${m.min_beds}:*`,
    limit: "500",
    offset: String(offset),
    includeTotalCount: "true",
  });
  const res = await fetch(`${base}/listings/sale?${q}`, { headers: { "X-Api-Key": key, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(25_000) });
  if (!res.ok) {
    const b = (await res.json().catch(() => ({}))) as Rc;
    if (res.status === 401 || res.status === 403) throw new Error("RentCast rejected the API key.");
    if (res.status === 429) throw new Error("RentCast's request limit was reached.");
    throw new Error(`RentCast error: ${s(b.message) || res.status}`);
  }
  const rows = (await res.json()) as Rc[];
  return { rows: Array.isArray(rows) ? rows : [], total: n(res.headers.get("x-total-count")) };
}

const median = (a: number[]) => {
  if (!a.length) return null;
  const x = [...a].sort((p, q) => p - q);
  const m = Math.floor(x.length / 2);
  return x.length % 2 ? x[m] : (x[m - 1] + x[m]) / 2;
};
const pct = (a: number[], p: number) => {
  if (!a.length) return null;
  const x = [...a].sort((u, v) => u - v);
  return x[Math.min(x.length - 1, Math.floor(p * (x.length - 1) + 0.5))];
};

type Existing = { rentcast_id: string; price: number | null; first_price: number | null; price_drops: number; status: string; first_seen_at: string; lead_id: string | null };

export type Vetted = ReturnType<typeof vet>;

/** Auction sites list homes on the MLS too; you can't put those under contract, so they're skipped. */
const AUCTION = /auction|xome|hubzu|realtybid|bid4assets|williams\s*(&|and)?\s*williams|hudson\s*(&|and)?\s*marshall|tranzon|ten-?x\b|\bbid\b|bidding|online sale/i;
export function isAuction(r: Rc) {
  const a = (r.listingAgent ?? {}) as Rc;
  const o = (r.listingOffice ?? {}) as Rc;
  const text = [r.listingType, r.mlsName, a.name, a.email, a.website, o.name, o.email, o.website].map(s).join(" ");
  return AUCTION.test(text);
}

/** Scores one listing. Exported for tests. */
export function vet(r: Rc, ctx: { zipMedian: number | null; zipP75: number | null; settings: AppSettings; prev?: Existing }) {
  const price = n(r.price);
  const sqft = n(r.squareFootage);
  const type = s(r.listingType) || "Standard";
  const dom = n(r.daysOnMarket);
  const hoa = n((r.hoa as Rc | undefined)?.fee);
  const year = n(r.yearBuilt);
  const flags: string[] = [];
  let score = 0;

  // Hard filters
  const reject: string[] = [];
  if (!price || !sqft) reject.push("missing price or size");
  if (sqft !== null && sqft < 700) reject.push("under 700 sq ft");
  if (type === "New Construction") reject.push("new construction");
  if (hoa !== null && hoa > 150) reject.push("HOA over $150/mo");
  if (isAuction(r)) reject.push("auction listing");

  // Motivation
  // Bank-owned homes: banks rarely accept assignable contracts, so only a small bump.
  if (type === "Foreclosure") { score += 10; flags.push("Bank-owned / foreclosure"); }
  if (type === "Short Sale") { score += 25; flags.push("Short sale"); }
  if (dom !== null) {
    if (dom >= 120) { score += 25; flags.push(`${dom} days on market`); }
    else if (dom >= 90) { score += 20; flags.push(`${dom} days on market`); }
    else if (dom >= 60) { score += 14; flags.push(`${dom} days on market`); }
    else if (dom >= 30) score += 6;
  }
  const prevPrice = ctx.prev?.price ?? null;
  const drops = (ctx.prev?.price_drops ?? 0) + (prevPrice && price && price < prevPrice ? 1 : 0);
  const firstPrice = ctx.prev?.first_price ?? price;
  if (drops > 0) { score += Math.min(24, drops * 12); flags.push(`Price cut${drops > 1 ? ` ×${drops}` : ""}${firstPrice && price && firstPrice > price ? ` (−${Math.round(((firstPrice - price) / firstPrice) * 100)}%)` : ""}`); }

  // Relisted: an earlier listing of this house in the last 12 months.
  const hist = (r.history ?? {}) as Record<string, Rc>;
  const listed = s(r.listedDate).slice(0, 10);
  const yearAgo = new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10);
  const relisted = Object.keys(hist).some((d) => d !== listed && d >= yearAgo && s(hist[d]?.event).includes("Sale"));
  if (relisted) { score += 10; flags.push("Relisted"); }

  // Price vs. the ZIP
  const ppsf = price && sqft ? price / sqft : null;
  let discount: number | null = null;
  if (ppsf && ctx.zipMedian) {
    discount = 1 - ppsf / ctx.zipMedian;
    if (discount >= 0.3) score += 30;
    else if (discount >= 0.2) score += 22;
    else if (discount >= 0.12) score += 12;
    if (discount >= 0.12) flags.push(`${Math.round(discount * 100)}% under ZIP $/sq ft`);
  }

  // Quick deal math: ARV ≈ upper-quartile $/sq ft in the ZIP (updated homes), less 5% list→sold.
  const rate = year !== null && year < 1960 ? ctx.settings.rehab_heavy_sqft : ctx.settings.rehab_medium_sqft;
  const arv = sqft && ctx.zipP75 ? Math.round((ctx.zipP75 * sqft * 0.95) / 1000) * 1000 : null;
  const repairs = sqft ? Math.round(sqft * rate) : null;
  const mao = arv !== null && repairs !== null ? Math.round(arv * (ctx.settings.default_mao_pct / 100) - repairs - ctx.settings.default_fee) : null;
  if (mao !== null && price) {
    if (price <= mao) { score += 25; flags.push("Price at/under max offer"); }
    else if (price <= mao * 1.15) { score += 15; flags.push("Within 15% of max offer"); }
    else if (price <= mao * 1.3) score += 6;
  }

  score = Math.min(100, score);
  return {
    price, sqft, dom, hoa, year, type, flags, drops, firstPrice, relisted,
    arv, repairs, mao, score, reject,
    qualified: reject.length === 0 && score >= 40,
  };
}

export async function scanMarket(db: SupabaseClient, m: Market, settings: AppSettings) {
  const started = new Date().toISOString();
  let requests = 0;
  try {
    const used = await rentcastUsedThisMonth(db);
    if (used >= MONTHLY_LIMIT) throw new Error(`RentCast monthly limit reached (${used}/${MONTHLY_LIMIT}). Scans resume next month, or raise RENTCAST_MONTHLY_LIMIT after upgrading.`);

    // Up to 2 pages (1,000 listings) per city per scan.
    const rows: Rc[] = [];
    let total: number | null = null;
    for (let page = 0; page < 2; page++) {
      if (used + requests >= MONTHLY_LIMIT) break;
      const res = await fetchPage(m, page * 500);
      requests++;
      rows.push(...res.rows);
      total = res.total;
      if (res.rows.length < 500 || (total !== null && rows.length >= total)) break;
    }

    // $/sq ft by ZIP (fall back to the whole city when a ZIP has fewer than 5 listings).
    const byZip = new Map<string, number[]>();
    const all: number[] = [];
    for (const r of rows) {
      const p = n(r.price), q = n(r.squareFootage);
      if (!p || !q || q < 500) continue;
      const v = p / q;
      all.push(v);
      const z = s(r.zipCode);
      byZip.set(z, [...(byZip.get(z) ?? []), v]);
    }
    const stat = (z: string) => {
      const a = byZip.get(z) ?? [];
      return a.length >= 5 ? { med: median(a), p75: pct(a, 0.75) } : { med: median(all), p75: pct(all, 0.75) };
    };

    const { data: ex } = await db.from("scan_listings").select("rentcast_id,price,first_price,price_drops,status,first_seen_at,lead_id").eq("market_id", m.id);
    const prev = new Map(((ex ?? []) as Existing[]).map((e) => [e.rentcast_id, e]));

    const now = new Date().toISOString();
    let qualified = 0;
    const unique = [...new Map(rows.filter((r) => s(r.id)).map((r) => [s(r.id), r])).values()];
    const upserts = unique
      .filter((r) => s(r.addressLine1 || r.formattedAddress))
      .map((r) => {
        const id = s(r.id);
        const z = s(r.zipCode);
        const st = stat(z);
        const p = prev.get(id);
        const v = vet(r, { zipMedian: st.med, zipP75: st.p75, settings, prev: p });
        if (v.qualified) qualified++;
        const agent = (r.listingAgent ?? null) as Rc | null;
        const office = (r.listingOffice ?? null) as Rc | null;
        return {
          market_id: m.id,
          rentcast_id: id,
          address: s(r.addressLine1) || s(r.formattedAddress).split(",")[0],
          city: s(r.city) || m.city,
          state: s(r.state) || m.state,
          zip: z || null,
          price: v.price,
          first_price: v.firstPrice,
          price_drops: v.drops,
          first_seen_at: p?.first_seen_at ?? now,
          last_seen_at: now,
          beds: n(r.bedrooms),
          baths: n(r.bathrooms),
          sqft: v.sqft,
          year_built: v.year,
          listing_type: v.type,
          days_on_market: v.dom,
          listed_date: s(r.listedDate).slice(0, 10) || null,
          relisted: v.relisted,
          hoa_fee: v.hoa,
          mls_number: s(r.mlsNumber) || null,
          agent: agent && (agent.name || agent.phone) ? { name: s(agent.name), phone: s(agent.phone), email: s(agent.email), website: s(agent.website) } : null,
          office: office && (office.name || office.phone) ? { name: s(office.name), phone: s(office.phone), email: s(office.email) } : null,
          zip_ppsf: st.med ? Math.round(st.med) : null,
          est_arv: v.arv,
          est_repairs: v.repairs,
          est_mao: v.mao,
          score: v.score,
          flags: v.reject.length ? [...v.flags, ...v.reject.map((x) => `Skipped: ${x}`)] : v.flags,
          qualified: v.qualified,
          status: p ? (p.status === "gone" ? "new" : p.status) : "new",
          lead_id: p?.lead_id ?? null,
        };
      });

    for (let i = 0; i < upserts.length; i += 500) {
      const { error } = await db.from("scan_listings").upsert(upserts.slice(i, i + 500), { onConflict: "rentcast_id" });
      if (error) throw new Error(error.message);
    }
    // Listings that disappeared (sold, pending or pulled) leave the list.
    await db.from("scan_listings").update({ status: "gone" }).eq("market_id", m.id).eq("status", "new").lt("last_seen_at", started);

    const note = total !== null && total > rows.length ? `Only the first ${rows.length} of ${total} listings were checked. Narrow the price range to cover them all.` : null;
    await db.from("scan_markets").update({ last_scanned_at: now, last_count: rows.length, last_qualified: qualified, last_error: note }).eq("id", m.id);
    await db.from("scan_runs").insert({ market_id: m.id, requests, listings: rows.length, qualified });
    return { listings: rows.length, qualified, requests };
  } catch (e) {
    const error = (e as Error).message;
    await db.from("scan_markets").update({ last_error: error }).eq("id", m.id);
    await db.from("scan_runs").insert({ market_id: m.id, requests, error });
    throw e;
  }
}
