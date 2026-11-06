import "server-only";

/** Everything one Tracerfy property lookup gives us, in the shape the CRM stores (leads.property_data). */
export type Phone = { number: string; type: string; dnc: boolean; tcpa: boolean; carrier: string; rank: number | null };
export type PropertyData = {
  hit: boolean;
  fetched_at: string;
  credits: number;
  owners: string[];
  mailing_address: string;
  phones: Phone[];
  emails: string[];
  litigator: boolean;
  property: {
    estimated_value: number | null;
    estimated_equity: number | null;
    equity_percent: number | null;
    assessed_value: number | null;
    open_mortgage_balance: number | null;
    lender_name: string;
    estimated_mortgage_payment: number | null;
    free_clear: boolean;
    high_equity: boolean;
    last_sale_date: string;
    last_sale_price: number | null;
    apn: string;
    county: string;
    year_built: number | null;
    beds: number | null;
    baths: number | null;
    sqft: number | null;
    lot_sqft: number | null;
    absentee_owner: boolean;
    owner_occupied: boolean;
    vacant: boolean;
    pre_foreclosure: boolean;
    tax_delinquent: boolean;
  };
};

export const LOOKUP_LIMIT = Number(process.env.TRACERFY_MONTHLY_LIMIT ?? 100);
export const CREDIT_PRICE = Number(process.env.TRACERFY_CREDIT_PRICE ?? 0.02);
export const tracerfyConfigured = () => Boolean(process.env.TRACERFY_API_KEY);

const num = (v: unknown) => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[$,%\s]/g, ""));
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());
const title = (v: string) => (v === v.toUpperCase() ? v.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()) : v);
const bool = (v: unknown) => v === true || v === 1 || /^(true|yes|y|1)$/i.test(str(v));

export function lookupKey(a: { address: string; city: string; state: string; zip?: string | null }) {
  const n = (s?: string | null) => (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return [n(a.address), n(a.city), n(a.state), n(a.zip)].join("|");
}

/** Splits "123 Main St, Dallas, TX 75216" when city/state weren't typed separately. */
export function splitAddress(line: string): { address: string; city: string; state: string; zip: string } | null {
  const m = line.match(/^\s*(.+?),\s*([^,]+?),\s*([A-Za-z]{2})\.?\s*(\d{5})?(?:-\d{4})?\s*$/);
  return m ? { address: m[1].trim(), city: m[2].trim(), state: m[3].toUpperCase(), zip: m[4] ?? "" } : null;
}

export async function lookupProperty(a: { address: string; city: string; state: string; zip?: string | null }): Promise<PropertyData> {
  const key = process.env.TRACERFY_API_KEY?.trim().replace(/^["']|["']$/g, "");
  if (!key) throw new Error("Owner lookup isn't connected yet. Add TRACERFY_API_KEY in Vercel, then redeploy.");
  const base = (process.env.TRACERFY_BASE_URL ?? "https://tracerfy.com/v1/api").replace(/\/$/, "");

  let res: Response;
  try {
    res = await fetch(`${base}/lead-builder/lookup/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ address: a.address, city: a.city, state: a.state, ...(a.zip ? { zip_code: a.zip } : {}) }),
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    throw new Error("Tracerfy didn't respond. Try again in a minute.");
  }
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg = str(body.detail || body.message || body.error) || `HTTP ${res.status}`;
    if (res.status === 401 || res.status === 403) throw new Error(`Tracerfy rejected the API key (${msg}). Check TRACERFY_API_KEY in Vercel.`);
    if (res.status === 402) throw new Error("Your Tracerfy account is out of credits. Add credits at tracerfy.com, then try again.");
    if (res.status === 429) throw new Error("Too many lookups at once. Wait a minute and try again.");
    throw new Error(`Tracerfy error: ${msg}`);
  }
  return normalize(body);
}

export function normalize(body: Record<string, unknown>): PropertyData {
  const p = (body.property ?? {}) as Record<string, unknown>;
  const c = (body.contacts ?? {}) as Record<string, unknown>;
  const m = (body.mailing_address ?? {}) as Record<string, unknown>;
  const owners = ((body.owners ?? []) as Record<string, unknown>[])
    .map((o) => str(o.full_name) || [str(o.first_name), str(o.last_name)].filter(Boolean).join(" "))
    .filter(Boolean)
    .map(title);
  const phones = ((c.phones ?? []) as Record<string, unknown>[])
    .map((ph) => ({ number: str(ph.number).replace(/\D/g, "").replace(/^1(?=\d{10}$)/, ""), type: str(ph.type), dnc: bool(ph.dnc), tcpa: bool(ph.tcpa), carrier: str(ph.carrier), rank: num(ph.rank) }))
    .filter((ph) => ph.number.length >= 10)
    .sort((x, y) => (x.rank ?? 99) - (y.rank ?? 99));
  const emails = ((c.emails ?? []) as Record<string, unknown>[])
    .sort((x, y) => (num(x.rank) ?? 99) - (num(y.rank) ?? 99))
    .map((e) => str(e.email))
    .filter((e) => e.includes("@"));

  return {
    hit: bool(body.hit),
    fetched_at: new Date().toISOString(),
    credits: num(body.credits_deducted) ?? 0,
    owners,
    mailing_address: [str(m.address), str(m.city), [str(m.state), str(m.zip)].filter(Boolean).join(" ")].filter(Boolean).join(", "),
    phones,
    emails,
    litigator: bool(c.litigator),
    property: {
      estimated_value: num(p.estimated_value),
      estimated_equity: num(p.estimated_equity),
      equity_percent: num(p.equity_percent),
      assessed_value: num(p.assessed_value),
      open_mortgage_balance: num(p.open_mortgage_balance),
      lender_name: str(p.lender_name),
      estimated_mortgage_payment: num(p.estimated_mortgage_payment),
      free_clear: bool(p.free_clear),
      high_equity: bool(p.high_equity),
      last_sale_date: str(p.last_sale_date).slice(0, 10),
      last_sale_price: num(p.last_sale_price),
      apn: str(p.apn),
      county: str(p.county),
      year_built: num(p.year_built),
      beds: num(p.beds),
      baths: num(p.baths),
      sqft: num(p.building_size_sqft),
      lot_sqft: num(p.lot_size_sqft),
      absentee_owner: bool(p.absentee_owner),
      owner_occupied: bool(p.owner_occupied),
      vacant: bool(p.vacant),
      pre_foreclosure: bool(p.pre_foreclosure),
      tax_delinquent: bool(p.tax_delinquent),
    },
  };
}

/** Best number to call: highest-ranked phone that isn't on Do Not Call and isn't a TCPA litigator. */
export function bestPhone(d: PropertyData) {
  if (d.litigator) return null;
  return d.phones.find((p) => !p.dnc && !p.tcpa)?.number ?? null;
}
