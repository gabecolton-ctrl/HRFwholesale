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

/* ───────────────────────── List builder (Lead Builder API) ───────────────────────── */

export type Preset = { key: string; label: string; description: string };
export type ListRequest = {
  strategy: string;
  geography: Record<string, unknown>;
  filter_overrides: Record<string, unknown>;
  requested_count: number;
  name?: string;
};

async function tf<T>(path: string, init: RequestInit & { revalidate?: number } = {}): Promise<{ status: number; body: T }> {
  const key = process.env.TRACERFY_API_KEY?.trim().replace(/^["']|["']$/g, "");
  if (!key) throw new Error("Tracerfy isn't connected yet. Add TRACERFY_API_KEY in Vercel, then redeploy.");
  const base = (process.env.TRACERFY_BASE_URL ?? "https://tracerfy.com/v1/api").replace(/\/$/, "");
  const { revalidate, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      ...rest,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json", ...(rest.headers ?? {}) },
      ...(revalidate ? { next: { revalidate } } : { cache: "no-store" as const }),
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    throw new Error("Tracerfy didn't respond. Try again in a minute.");
  }
  const body = (await res.json().catch(() => ({}))) as T & Record<string, unknown>;
  if (!res.ok && res.status !== 409) {
    const b = body as Record<string, unknown>;
    const msg = str(b.detail || b.message || b.error) || `HTTP ${res.status}`;
    if (res.status === 401 || res.status === 403) throw new Error(`Tracerfy rejected the API key (${msg}).`);
    if (res.status === 402) throw new Error("Your Tracerfy account doesn't have enough credits for this list. Add credits at tracerfy.com.");
    if (res.status === 429) throw new Error("Tracerfy's limit is 10 list builds an hour. Try again later.");
    throw new Error(msg);
  }
  return { status: res.status, body };
}

/** Ready-made list strategies (high-equity absentee, tired landlord, pre-foreclosure…). Cached 1 hour. */
export async function listPresets(): Promise<Preset[]> {
  const { body } = await tf<unknown>("/lead-builder/filters/", { method: "GET", revalidate: 3600 });
  const arr = Array.isArray(body) ? body : ((body as Record<string, unknown>).strategies ?? (body as Record<string, unknown>).results ?? (body as Record<string, unknown>).presets ?? []);
  return (arr as Record<string, unknown>[])
    .map((p) => ({ key: str(p.key), label: str(p.label) || str(p.key), description: str(p.description) }))
    .filter((p) => p.key);
}

export async function previewList(req: ListRequest) {
  const { body } = await tf<Record<string, unknown>>("/lead-builder/preview/", { method: "POST", body: JSON.stringify({ ...req, include_pins: false }) });
  return {
    total: num(body.total_matches ?? body.total_count ?? body.count) ?? 0,
    capped: num(body.capped_count) ?? 0,
    maxCredits: num(body.max_credit_cost) ?? 0,
  };
}

export async function executeList(req: ListRequest) {
  const { body } = await tf<Record<string, unknown>>("/lead-builder/execute/", { method: "POST", body: JSON.stringify(req) });
  const id = str(body.id);
  if (!id) throw new Error("Tracerfy didn't start the list. Try again.");
  return { id, maxCredits: num(body.max_credit_cost) ?? 0 };
}

export async function listStatus(id: string) {
  const { body } = await tf<Record<string, unknown>>(`/lead-builder/${encodeURIComponent(id)}/`, { method: "GET" });
  const status = str(body.status).toLowerCase();
  return {
    done: status === "completed" || status === "complete" || status === "done",
    failed: status === "failed" || status === "error",
    progress: num(body.progress_percent),
    stage: str(body.progress_stage),
    count: num(body.actual_count),
    credits: num(body.credits_deducted) ?? 0,
    error: str(body.error || body.detail),
  };
}

export async function listRows(id: string, page: number) {
  const { status, body } = await tf<Record<string, unknown>>(`/lead-builder/${encodeURIComponent(id)}/rows/?page=${page}&per_page=500`, { method: "GET" });
  if (status === 409) return { ready: false, rows: [] as Record<string, unknown>[], totalPages: 0 };
  return { ready: true, rows: (body.rows ?? []) as Record<string, unknown>[], totalPages: num(body.total_pages) ?? 1 };
}

/** One list row → the same shape a single lookup gives us. */
export function rowToPropertyData(r: Record<string, unknown>): PropertyData {
  const phones: Phone[] = [];
  const add = (prefix: string, rank: number) => {
    const n = str(r[prefix]).replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
    if (n.length >= 10 && !phones.some((p) => p.number === n)) {
      phones.push({ number: n, type: str(r[`${prefix}_type`]) || (prefix.startsWith("mobile") ? "Mobile" : ""), dnc: bool(r[`${prefix}_dnc`]), tcpa: bool(r[`${prefix}_tcpa`]), carrier: str(r[`${prefix}_carrier`]), rank });
    }
  };
  add("primary_phone", 0);
  for (let i = 1; i <= 10; i++) add(`mobile_${i}`, i);
  for (let i = 1; i <= 5; i++) add(`landline_${i}`, 10 + i);
  const owners = [1, 2]
    .map((i) => [str(r[`owner_${i}_first_name`]), str(r[`owner_${i}_last_name`])].filter(Boolean).join(" "))
    .filter(Boolean)
    .map(title);
  return {
    hit: true,
    fetched_at: new Date().toISOString(),
    credits: 5,
    owners,
    mailing_address: [str(r.mail_address), str(r.mail_city), [str(r.mail_state), str(r.mail_zip)].filter(Boolean).join(" ")].filter(Boolean).join(", "),
    phones,
    emails: [1, 2, 3].map((i) => str(r[`email_${i}`])).filter((e) => e.includes("@")),
    litigator: bool(r.litigator),
    property: {
      estimated_value: num(r.estimated_value),
      estimated_equity: num(r.estimated_equity),
      equity_percent: num(r.equity_percent),
      assessed_value: num(r.assessed_value),
      open_mortgage_balance: num(r.open_mortgage_balance),
      lender_name: str(r.lender_name),
      estimated_mortgage_payment: num(r.estimated_mortgage_payment),
      free_clear: bool(r.free_clear),
      high_equity: bool(r.high_equity),
      last_sale_date: str(r.last_sale_date).slice(0, 10),
      last_sale_price: num(r.last_sale_price),
      apn: str(r.apn),
      county: str(r.county),
      year_built: num(r.year_built),
      beds: num(r.beds),
      baths: num(r.baths),
      sqft: num(r.building_size_sqft),
      lot_sqft: num(r.lot_size_sqft),
      absentee_owner: bool(r.absentee_owner),
      owner_occupied: bool(r.owner_occupied),
      vacant: bool(r.vacant),
      pre_foreclosure: bool(r.pre_foreclosure),
      tax_delinquent: bool(r.tax_delinquent),
    },
  };
}
