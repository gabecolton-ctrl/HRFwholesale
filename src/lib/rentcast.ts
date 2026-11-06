import "server-only";

/** One comparable as the CRM stores it (same shape as CompsEditor rows, plus a few extras). */
export type Comp = {
  address: string;
  sold_price: string;   // RentCast list price (Texas: not the true sold price)
  sold_date: string;    // date it went off market (or last seen)
  beds: string;
  baths: string;
  sqft: string;
  distance: string;     // "0.4 mi"
  status: "Active" | "Inactive" | string;
  days_old: number | null;
  days_on_market: number | null;
  property_type: string;
};

export type CompsResult = {
  estimate: number | null;
  estimate_low: number | null;
  estimate_high: number | null;
  subject: {
    address: string;
    beds: number | null;
    baths: number | null;
    sqft: number | null;
    year_built: number | null;
    property_type: string;
    last_sale_date: string | null;
    last_sale_price: number | null;
  };
  comps: Comp[];
};

export const MONTHLY_LIMIT = Number(process.env.RENTCAST_MONTHLY_LIMIT ?? 50);
export const rentcastConfigured = () => Boolean(process.env.RENTCAST_API_KEY);

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

/** Normalized key so "123 Main St, Dallas TX" and "123 main st dallas, tx" share a cache entry. */
export function compsKey(address: string, radius: string) {
  return `${address.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}|${radius}`;
}

type RcComp = Record<string, unknown>;

export async function fetchComps(opts: { address: string; radius: number; sqft?: number | null; beds?: number | null; baths?: number | null }): Promise<CompsResult> {
  const key = process.env.RENTCAST_API_KEY?.trim().replace(/^["']|["']$/g, "");
  if (!key) throw new Error("RentCast isn't connected yet. Add RENTCAST_API_KEY in Vercel, then redeploy.");
  const base = process.env.RENTCAST_BASE_URL ?? "https://api.rentcast.io/v1";
  const q = new URLSearchParams({
    address: opts.address,
    compCount: "25",
    maxRadius: String(opts.radius),
    daysOld: "365",
    lookupSubjectAttributes: "true",
  });
  if (opts.sqft) q.set("squareFootage", String(opts.sqft));
  if (opts.beds) q.set("bedrooms", String(opts.beds));
  if (opts.baths) q.set("bathrooms", String(opts.baths));

  const res = await fetch(`${base}/avm/value?${q}`, { headers: { "X-Api-Key": key, Accept: "application/json" }, cache: "no-store" });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg = s(body.message || body.error) || `HTTP ${res.status}`;
    if (res.status === 401 || res.status === 403) throw new Error(`RentCast rejected the API key (${msg}). Check RENTCAST_API_KEY in Vercel.`);
    if (res.status === 404) throw new Error("RentCast couldn't find that address. Try the full address with city, state and ZIP.");
    if (res.status === 429) throw new Error("RentCast's request limit was reached. Try again later or upgrade your RentCast plan.");
    throw new Error(`RentCast error: ${msg}`);
  }

  const sp = (body.subjectProperty ?? {}) as Record<string, unknown>;
  const comps = ((body.comparables ?? []) as RcComp[]).map((c): Comp => ({
    address: s(c.formattedAddress || c.addressLine1),
    sold_price: s(n(c.price)),
    sold_date: s(c.removedDate || c.lastSeenDate || c.listedDate).slice(0, 10),
    beds: s(n(c.bedrooms)),
    baths: s(n(c.bathrooms)),
    sqft: s(n(c.squareFootage)),
    distance: n(c.distance) !== null ? `${(c.distance as number).toFixed(2)} mi` : "",
    status: s(c.status),
    days_old: n(c.daysOld),
    days_on_market: n(c.daysOnMarket),
    property_type: s(c.propertyType),
  }));

  return {
    estimate: n(body.price),
    estimate_low: n(body.priceRangeLow),
    estimate_high: n(body.priceRangeHigh),
    subject: {
      address: s(sp.formattedAddress) || opts.address,
      beds: n(sp.bedrooms) ?? opts.beds ?? null,
      baths: n(sp.bathrooms) ?? opts.baths ?? null,
      sqft: n(sp.squareFootage) ?? opts.sqft ?? null,
      year_built: n(sp.yearBuilt),
      property_type: s(sp.propertyType),
      last_sale_date: sp.lastSaleDate ? s(sp.lastSaleDate).slice(0, 10) : null,
      last_sale_price: n(sp.lastSalePrice),
    },
    comps,
  };
}
