export type PortalDeal = {
  id: string;
  status: "Available" | "Pending";
  area: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  property_type: string | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  year_built: number | null;
  arv: number | null;
  repair_estimate: number | null;
  rehab_level: string | null;
  list_price: number | null;
  closing_date: string | null;
  description: string | null;
  photo_paths: string[];
  comps: { address?: string; sold_price?: number; sold_date?: string; beds?: number; baths?: number; sqft?: number; distance?: string }[];
  published_at: string | null;
  acknowledged: boolean;
  address: string | null;
};

export function publicPhoto(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/deal-photos/${path}`;
}

export function where(d: Pick<PortalDeal, "area" | "city" | "state" | "zip">) {
  return [d.area, d.city, d.state].filter(Boolean).join(", ") || (d.zip ? `ZIP ${d.zip}` : "United States");
}

export function specs(d: Pick<PortalDeal, "beds" | "baths" | "sqft">) {
  return [d.beds != null && `${Number(d.beds)} bd`, d.baths != null && `${Number(d.baths)} ba`, d.sqft != null && `${Number(d.sqft).toLocaleString()} sqft`]
    .filter(Boolean)
    .join(" · ");
}

type BuyBox = { areas: string[]; price_min: number | null; price_max: number | null; rehab_levels: string[]; property_types: string[] };

/** Same rules as the database's alert matching, for the "Fits your buy box" badge. */
export function fitsBuyBox(d: PortalDeal, b: BuyBox | null) {
  if (!b) return false;
  const hay = [d.zip, d.city, d.area, d.state].filter(Boolean).map((x) => String(x).toLowerCase());
  const areaOk =
    b.areas.length === 0 ||
    b.areas.some((a) => {
      const x = a.trim().toLowerCase();
      return hay.includes(x) || (x.length >= 4 && hay.join(" ").includes(x));
    });
  const p = d.list_price;
  const priceOk = p == null || ((b.price_min == null || p >= Number(b.price_min)) && (b.price_max == null || p <= Number(b.price_max)));
  const rehabOk = b.rehab_levels.length === 0 || !d.rehab_level || b.rehab_levels.includes(d.rehab_level);
  const typeOk = b.property_types.length === 0 || !d.property_type || b.property_types.includes(d.property_type);
  return areaOk && priceOk && rehabOk && typeOk;
}
