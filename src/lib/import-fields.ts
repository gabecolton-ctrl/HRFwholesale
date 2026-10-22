// Field definitions for CSV import, with the column names PropStream, the
// workbook and common spreadsheets use, so columns map automatically.

export type ImportField = { key: string; label: string; aliases: string[]; required?: boolean };

export const LEAD_FIELDS: ImportField[] = [
  { key: "seller_name", label: "Seller / owner name", aliases: ["seller name", "owner name", "owner", "name", "seller", "owner 1 full name", "full name", "contact name"], required: true },
  { key: "first_name", label: "First name (joined into name)", aliases: ["first name", "owner 1 first name", "owner first name", "firstname"] },
  { key: "last_name", label: "Last name (joined into name)", aliases: ["last name", "owner 1 last name", "owner last name", "lastname"] },
  { key: "address", label: "Property address", aliases: ["property address", "address", "street address", "site address", "street", "property street"], required: true },
  { key: "city", label: "City", aliases: ["city", "property city", "site city"] },
  { key: "state", label: "State", aliases: ["state", "property state", "st"] },
  { key: "zip", label: "ZIP", aliases: ["zip", "zip code", "zipcode", "property zip", "postal code", "site zip"] },
  { key: "county", label: "County", aliases: ["county"] },
  { key: "phone", label: "Phone", aliases: ["phone", "phone 1", "phone number", "mobile", "cell", "mobile phone", "primary phone", "phone1"] },
  { key: "email", label: "Email", aliases: ["email", "email 1", "email address", "e-mail"] },
  { key: "mailing_address", label: "Mailing address", aliases: ["mailing address", "mail address", "owner mailing address"] },
  { key: "property_type", label: "Property type", aliases: ["property type", "type", "land use"] },
  { key: "beds", label: "Beds", aliases: ["beds", "bedrooms", "bed"] },
  { key: "baths", label: "Baths", aliases: ["baths", "bathrooms", "bath"] },
  { key: "sqft", label: "Sq ft", aliases: ["sqft", "sq ft", "square feet", "building sqft", "living area", "living sqft"] },
  { key: "year_built", label: "Year built", aliases: ["year built", "yr built", "effective year built"] },
  { key: "condition", label: "Condition", aliases: ["condition", "property condition"] },
  { key: "occupancy", label: "Occupancy", aliases: ["occupancy", "owner occupied", "vacant"] },
  { key: "reason_for_selling", label: "Reason for selling", aliases: ["reason", "reason for selling", "motivation reason", "situation"] },
  { key: "timeline", label: "Timeline", aliases: ["timeline", "time frame", "timeframe"] },
  { key: "asking_price", label: "Asking price", aliases: ["asking price", "asking", "price"] },
  { key: "motivation", label: "Motivation (1–5)", aliases: ["motivation", "motivation (1-5)", "motivation score", "rating"] },
  { key: "lead_source", label: "Lead source", aliases: ["lead source", "source", "list", "list name"] },
  { key: "status", label: "Status", aliases: ["status", "lead status", "stage"] },
  { key: "est_arv", label: "Est. ARV / value", aliases: ["arv", "est arv", "est. arv", "estimated value", "est. value", "est value", "avm", "market value"] },
  { key: "est_repairs", label: "Est. repairs", aliases: ["repairs", "est repairs", "repair estimate", "est. repairs", "rehab"] },
  { key: "mortgage_balance", label: "Mortgage balance", aliases: ["mortgage balance", "loan balance", "total loan balance", "open mortgage balance", "est. loan balance"] },
  { key: "offer_amount", label: "Offer amount", aliases: ["offer", "offer amount", "offer price"] },
  { key: "next_follow_up", label: "Next follow-up date", aliases: ["next follow-up", "next follow up", "follow up date", "next contact", "follow-up date"] },
  { key: "keep_candidate", label: "Keep candidate (yes/no)", aliases: ["keep candidate", "keep", "keeper"] },
  { key: "do_not_call", label: "Do Not Call (yes/no)", aliases: ["dnc", "do not call", "litigator", "do not contact"] },
  { key: "notes", label: "Notes", aliases: ["notes", "note", "comments"] },
];

export const BUYER_FIELDS: ImportField[] = [
  { key: "name", label: "Buyer name", aliases: ["name", "buyer name", "buyer", "contact", "contact name", "full name"], required: true },
  { key: "first_name", label: "First name (joined into name)", aliases: ["first name", "firstname"] },
  { key: "last_name", label: "Last name (joined into name)", aliases: ["last name", "lastname"] },
  { key: "company", label: "Company", aliases: ["company", "llc", "entity", "business", "buyer entity"] },
  { key: "phone", label: "Phone", aliases: ["phone", "phone number", "mobile", "cell"] },
  { key: "email", label: "Email", aliases: ["email", "email address", "e-mail"] },
  { key: "areas", label: "Areas / ZIPs", aliases: ["areas", "area", "zips", "zip codes", "markets", "target areas", "buy areas", "areas/zips"] },
  { key: "price_min", label: "Min price", aliases: ["min price", "price min", "minimum price", "min"] },
  { key: "price_max", label: "Max price", aliases: ["max price", "price max", "maximum price", "max"] },
  { key: "property_types", label: "Property types", aliases: ["property types", "property type", "types"] },
  { key: "rehab_levels", label: "Rehab level(s)", aliases: ["rehab level", "rehab levels", "rehab", "condition"] },
  { key: "strategies", label: "Flip / hold", aliases: ["strategy", "strategies", "flip or hold", "flip/hold", "exit"] },
  { key: "tier", label: "Tier (A/B/C)", aliases: ["tier", "rank", "priority"] },
  { key: "source", label: "Source", aliases: ["source", "how found", "where found"] },
  { key: "pof_verified", label: "POF verified (yes/no)", aliases: ["pof", "pof verified", "proof of funds"] },
  { key: "notes", label: "Notes", aliases: ["notes", "comments"] },
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Best-guess mapping from CSV headers to fields. */
export function autoMap(headers: string[], fields: ImportField[]) {
  const map: Record<string, string> = {};
  const used = new Set<string>();
  for (const f of fields) {
    const hit = headers.find((h) => !used.has(h) && f.aliases.some((a) => norm(a) === norm(h)));
    if (hit) {
      map[f.key] = hit;
      used.add(hit);
    }
  }
  // If both first+last name exist, prefer them over a missing full name.
  return map;
}
