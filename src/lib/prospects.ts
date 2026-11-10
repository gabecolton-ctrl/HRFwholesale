/**
 * Turns a PropStream (or similar) property export into buyer prospects.
 * Each row is one property; the same owner shows up once per property they bought.
 * We group rows by owner (name + mailing ZIP), count purchases, and score how active they are.
 * Runs in the browser, so big files never have to be uploaded whole.
 */

export type Prospect = {
  owner_key: string;
  name: string;
  is_company: boolean;
  mailing_address: string | null;
  phones: { number: string; type: string; dnc: boolean }[];
  emails: string[];
  purchases: number;
  purchases_12mo: number;
  last_purchase: string | null;
  price_min: number | null;
  price_max: number | null;
  avg_price: number | null;
  zips: string[];
  cities: string[];
  property_types: string[];
  properties: { address: string; city: string; zip: string; date: string | null; price: number | null; type: string }[];
  score: number;
  suggested_tier: "A" | "B" | "C";
};

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");
const COMPANY = /\b(llc|l\.l\.c|inc|corp|corporation|co|company|lp|llp|ltd|trust|holdings?|properties|property|investments?|investors?|capital|group|ventures?|homes|realty|partners|partnership|enterprises?|equity|assets|acquisitions|development|management|fund|reit)\b/i;

function pick(headers: string[], ...candidates: string[]) {
  const n = headers.map((h) => [h, norm(h)] as const);
  for (const c of candidates) {
    const hit = n.find(([, x]) => x === c);
    if (hit) return hit[0];
  }
  return null;
}

/** Works out which column holds what. Returns null fields when a column isn't there. */
export function detectColumns(headers: string[]) {
  const phoneCols = headers.filter((h) => /(phone|mobile|wireless|landline|cell)/i.test(h) && !/(type|dnc|status|carrier|score|litigator|tcpa|connected)/i.test(h));
  const emailCols = headers.filter((h) => /e-?mail/i.test(h) && !/(status|valid|verified|optin|opt-in)/i.test(h));
  return {
    first: pick(headers, "owner1firstname", "ownerfirstname", "firstname", "owner1first"),
    last: pick(headers, "owner1lastname", "ownerlastname", "lastname", "owner1last"),
    full: pick(headers, "owner1fullname", "ownerfullname", "owner1name", "ownername", "owner", "owners", "fullname", "name", "buyername", "grantee", "buyer"),
    mailAddr: pick(headers, "mailingaddress", "mailaddress", "ownermailingaddress", "mailingstreetaddress", "mailingaddress1"),
    mailCity: pick(headers, "mailingcity", "mailcity", "ownermailingcity"),
    mailState: pick(headers, "mailingstate", "mailstate", "ownermailingstate"),
    mailZip: pick(headers, "mailingzip", "mailingzipcode", "mailzip", "mailzipcode", "ownermailingzip"),
    addr: pick(headers, "address", "propertyaddress", "siteaddress", "streetaddress", "propertystreetaddress"),
    city: pick(headers, "city", "propertycity", "sitecity"),
    zip: pick(headers, "zip", "zipcode", "propertyzip", "propertyzipcode", "sitezip"),
    date: pick(headers, "lastsaledate", "lastsalerecordingdate", "saledate", "recordingdate", "purchasedate", "lastsalesdate", "transferdate", "lastpurchasedate"),
    price: pick(headers, "lastsaleamount", "lastsaleprice", "saleprice", "saleamount", "purchaseprice", "lastsalesprice", "transferamount", "lastpurchaseprice"),
    type: pick(headers, "propertytype", "landuse", "propertyusegroup", "propertyuse", "type"),
    phoneCols,
    emailCols,
  };
}

const money = (v: unknown) => {
  const n = Number(String(v ?? "").replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n > 1000 ? n : null; // ignore $0 / $10 "love and affection" transfers
};
function isoDate(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  if (Number.isFinite(n) && n > 20000 && n < 80000) return new Date(Date.UTC(1899, 11, 30) + n * 86_400_000).toISOString().slice(0, 10); // Excel serial date
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}
function mapType(t: string) {
  const s = t.toLowerCase();
  if (!s) return "";
  if (/single|sfr|residential$/.test(s)) return "Single family";
  if (/duplex/.test(s)) return "Duplex";
  if (/tri|four|quad/.test(s)) return "Triplex/Fourplex";
  if (/multi|apartment/.test(s)) return "Multifamily 5+";
  if (/town/.test(s)) return "Townhome";
  if (/condo/.test(s)) return "Condo";
  if (/mobile|manufactured/.test(s)) return "Mobile home";
  if (/land|lot|vacant/.test(s)) return "Land";
  return "";
}
const titleCase = (s: string) => (s === s.toUpperCase() ? s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\bLlc\b/g, "LLC").replace(/\bLp\b/g, "LP") : s);
const top = (arr: string[], k: number) => {
  const c = new Map<string, number>();
  for (const a of arr) if (a) c.set(a, (c.get(a) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, k).map(([x]) => x);
};

export function buildProspects(rows: Record<string, unknown>[], headers: string[], today = new Date()) {
  const c = detectColumns(headers);
  const v = (r: Record<string, unknown>, col: string | null) => (col ? String(r[col] ?? "").trim() : "");
  const yearAgo = new Date(today.getTime() - 365 * 86_400_000).toISOString().slice(0, 10);
  const halfYear = new Date(today.getTime() - 183 * 86_400_000).toISOString().slice(0, 10);
  const groups = new Map<string, { rows: Record<string, unknown>[]; name: string; mail: string; mailZip: string }>();
  let skipped = 0;

  for (const r of rows) {
    const name = v(r, c.full) || [v(r, c.first), v(r, c.last)].filter(Boolean).join(" ");
    if (!name) { skipped++; continue; }
    const mailZip = v(r, c.mailZip).replace(/\D/g, "").slice(0, 5);
    const mail = [v(r, c.mailAddr), v(r, c.mailCity), [v(r, c.mailState), mailZip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    const key = `${name.toUpperCase().replace(/[^A-Z0-9 ]/g, "").replace(/\s+/g, " ").trim()}|${mailZip || v(r, c.mailAddr).toUpperCase()}`;
    const g = groups.get(key) ?? { rows: [], name, mail, mailZip };
    g.rows.push(r);
    groups.set(key, g);
  }

  const prospects: Prospect[] = [];
  for (const [key, g] of groups) {
    // Skip $1–$1,000 sales: family or quitclaim transfers, not real purchases.
    const real = g.rows.filter((r) => {
      if (!c.price) return true;
      const raw = String(r[c.price] ?? "").replace(/[$,\s]/g, "");
      return raw === "" || !Number.isFinite(Number(raw)) || Number(raw) === 0 || Number(raw) > 1000;
    });
    if (real.length === 0) continue;
    const props = real.map((r) => ({
      address: v(r, c.addr), city: v(r, c.city), zip: v(r, c.zip).replace(/\D/g, "").slice(0, 5),
      date: isoDate(c.date ? r[c.date] : null), price: money(c.price ? r[c.price] : null), type: mapType(v(r, c.type)),
    }));
    // The same property can appear twice in an export; count it once.
    const uniq = [...new Map(props.map((p) => [`${p.address.toUpperCase()}|${p.zip}`, p])).values()].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
    const prices = uniq.map((p) => p.price).filter((x): x is number => x !== null);
    const recent = uniq.filter((p) => p.date && p.date >= yearAgo).length;
    const last = uniq.find((p) => p.date)?.date ?? null;

    const phones = new Map<string, { number: string; type: string; dnc: boolean }>();
    const emails = new Set<string>();
    for (const r of g.rows) {
      for (const pc of c.phoneCols) {
        const num = v(r, pc).replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
        if (num.length !== 10 || phones.has(num)) continue;
        const dncCol = headers.find((h) => h !== pc && h.toLowerCase().startsWith(pc.toLowerCase()) && /dnc/i.test(h));
        const typeCol = headers.find((h) => h !== pc && h.toLowerCase().startsWith(pc.toLowerCase()) && /type/i.test(h));
        phones.set(num, { number: num, type: typeCol ? v(r, typeCol) : /mobile|wireless|cell/i.test(pc) ? "Mobile" : "", dnc: dncCol ? /^(y|yes|true|1|dnc)$/i.test(v(r, dncCol)) : false });
      }
      for (const ec of c.emailCols) {
        const e = v(r, ec).toLowerCase();
        if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) emails.add(e);
      }
    }
    const isCo = COMPANY.test(g.name);
    const cleanPhones = [...phones.values()].filter((p) => !p.dnc);

    let score = Math.min(60, recent * 20) + Math.min(15, Math.max(0, uniq.length - recent) * 5);
    if (last && last >= halfYear) score += 10;
    if (isCo) score += 5;
    if (cleanPhones.length) score += 10;
    if (emails.size) score += 5;
    score = Math.min(100, score);
    const tier: "A" | "B" | "C" = recent >= 3 || score >= 70 ? "A" : recent >= 1 || score >= 40 ? "B" : "C";

    prospects.push({
      owner_key: key,
      name: titleCase(g.name),
      is_company: isCo,
      mailing_address: g.mail ? titleCase(g.mail) : null,
      phones: [...phones.values()],
      emails: [...emails],
      purchases: uniq.length,
      purchases_12mo: recent,
      last_purchase: last,
      price_min: prices.length ? Math.min(...prices) : null,
      price_max: prices.length ? Math.max(...prices) : null,
      avg_price: prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null,
      zips: top(uniq.map((p) => p.zip), 8),
      cities: top(uniq.map((p) => titleCase(p.city)), 5),
      property_types: top(uniq.map((p) => p.type), 4),
      properties: uniq.slice(0, 25).map((p) => ({ ...p, address: titleCase(p.address), city: titleCase(p.city) })),
      score,
      suggested_tier: tier,
    });
  }
  prospects.sort((a, b) => b.score - a.score);
  return { prospects, skipped, columns: c };
}
