"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { toNumber, toText } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { scanMarket, type Market } from "@/lib/scanner";

function go(path: string, params: Record<string, string | number | null | undefined> = {}): never {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== "") q.set(k, String(v));
  redirect(`${path}${q.size ? `?${q}` : ""}`);
}
const backTo = (fd: FormData) => {
  const b = String(fd.get("back") ?? "/crm/scanner");
  return b.startsWith("/crm/scanner") ? b : "/crm/scanner";
};
const withParams = (path: string, add: Record<string, string | number>) => {
  const u = new URL(path, "http://x");
  for (const [k, v] of Object.entries(add)) u.searchParams.set(k, String(v));
  return `${u.pathname}${u.search}`;
};
const usd = (v: number | null) => (v == null ? "?" : `$${Math.round(v).toLocaleString("en-US")}`);

type L = {
  id: string; address: string; city: string | null; state: string | null; zip: string | null; price: number | null; beds: number | null; baths: number | null;
  sqft: number | null; year_built: number | null; days_on_market: number | null; listing_type: string | null; mls_number: string | null;
  agent: { name?: string; phone?: string; email?: string } | null; office: { name?: string; phone?: string } | null;
  flags: string[]; est_arv: number | null; est_repairs: number | null; est_mao: number | null; score: number; address_key: string; status: string;
};

/** Turns checked listings into leads (the listing agent is the contact). */
export async function makeLeadsFromListings(fd: FormData) {
  const { supabase, user, profile } = await requireRole("owner", "acquisitions", "va");
  const back = backTo(fd);
  const ids = fd.getAll("ids").map(String).filter(Boolean).slice(0, 100);
  if (!ids.length) redirect(withParams(back, { error: "Check at least one listing first." }));
  const { data } = await supabase.from("scan_listings").select("*").in("id", ids);
  const rows = ((data ?? []) as L[]).filter((r) => r.status !== "lead");
  const keys = rows.map((r) => r.address_key);
  const { data: existing } = keys.length ? await supabase.from("leads").select("id,address_key").in("address_key", keys) : { data: [] };
  const byKey = new Map((existing ?? []).map((l) => [l.address_key as string, l.id as string]));

  let made = 0, linked = 0;
  for (const r of rows) {
    let leadId = byKey.get(r.address_key);
    if (leadId) linked++;
    else {
      const a = r.agent ?? {};
      const notes = [
        `On-market listing found by the Deal Scanner (score ${r.score}).`,
        `Listing agent: ${a.name || "unknown"}${a.phone ? `, ${a.phone}` : ""}${a.email ? `, ${a.email}` : ""}`,
        r.office?.name ? `Office: ${r.office.name}${r.office.phone ? `, ${r.office.phone}` : ""}` : "",
        `List price ${usd(r.price)} · ${r.days_on_market ?? "?"} days on market${r.listing_type && r.listing_type !== "Standard" ? ` · ${r.listing_type}` : ""}${r.mls_number ? ` · MLS #${r.mls_number}` : ""}`,
        r.flags.filter((f) => !f.startsWith("Skipped")).join(" · "),
        `Rough numbers: ARV ${usd(r.est_arv)}, repairs ${usd(r.est_repairs)}, max offer ${usd(r.est_mao)}. Pull comps before offering.`,
      ].filter(Boolean).join("\n");
      const row: Record<string, unknown> = {
        seller_name: a.name ? `${a.name} (listing agent)` : "Listing agent",
        phone: (a.phone ?? "").replace(/\D/g, "").slice(-10) || null,
        email: a.email || null,
        address: r.address, city: r.city, state: r.state ?? "TX", zip: r.zip,
        property_type: "Single family",
        beds: r.beds, baths: r.baths, sqft: r.sqft, year_built: r.year_built,
        asking_price: r.price, est_arv: r.est_arv, est_repairs: r.est_repairs,
        reason_for_selling: r.flags.filter((f) => !f.startsWith("Skipped")).join(", ").slice(0, 300) || null,
        lead_source: "On-market (MLS)",
        notes,
        created_by: user.id,
      };
      if (profile.role === "acquisitions") row.assigned_to = user.id;
      const { data: ins, error } = await supabase.from("leads").insert(row).select("id").single();
      if (error || !ins) redirect(withParams(back, { error: `Stopped at ${r.address}: ${error?.message ?? "couldn't create the lead"}`, made }));
      leadId = ins.id as string;
      byKey.set(r.address_key, leadId);
      made++;
    }
    await supabase.from("scan_listings").update({ status: "lead", lead_id: leadId }).eq("id", r.id);
  }
  revalidatePath("/crm/leads");
  revalidatePath("/crm/scanner");
  redirect(withParams(back, { made, linked }));
}

export async function setListingStatus(fd: FormData) {
  const { supabase } = await requireRole("owner", "acquisitions", "va");
  const back = backTo(fd);
  const ids = fd.getAll("ids").map(String).filter(Boolean).slice(0, 500);
  const to = fd.get("to") === "new" ? "new" : "dismissed";
  if (!ids.length) redirect(withParams(back, { error: "Check at least one listing first." }));
  await supabase.from("scan_listings").update({ status: to }).in("id", ids).neq("status", "lead");
  revalidatePath("/crm/scanner");
  redirect(withParams(back, { [to === "new" ? "restored" : "dismissed"]: ids.length }));
}

/* ───────── Cities (owner) ───────── */

export async function scanNow(fd: FormData) {
  const { supabase } = await requireRole("owner");
  const { data: m } = await supabase.from("scan_markets").select("*").eq("id", String(fd.get("id"))).maybeSingle();
  if (!m) go("/crm/scanner/markets", { error: "City not found." });
  let r: { listings: number; qualified: number; requests: number };
  try {
    r = await scanMarket(supabase, m as Market, await getSettings(supabase));
  } catch (e) {
    go("/crm/scanner/markets", { error: `${m.city}: ${(e as Error).message}` });
  }
  revalidatePath("/crm/scanner");
  go("/crm/scanner/markets", { scanned: m.city, listings: r.listings, qualified: r.qualified, requests: r.requests });
}

export async function saveMarket(fd: FormData) {
  const { supabase } = await requireRole("owner");
  const id = toText(fd.get("id"));
  const city = toText(fd.get("city"));
  const state = (toText(fd.get("state")) ?? "").toUpperCase();
  if (!city || !/^[A-Z]{2}$/.test(state)) go("/crm/scanner/markets", { error: "Enter a city and its 2-letter state." });
  const row = {
    city: city.replace(/\b\w/g, (c) => c.toUpperCase()),
    state,
    price_min: Math.max(0, toNumber(fd.get("price_min")) ?? 60000),
    price_max: Math.max(10000, toNumber(fd.get("price_max")) ?? 350000),
    min_beds: Math.max(0, Math.min(6, toNumber(fd.get("min_beds")) ?? 2)),
    active: id ? fd.get("active") === "on" : true,
  };
  const { error } = id ? await supabase.from("scan_markets").update(row).eq("id", id) : await supabase.from("scan_markets").insert(row);
  if (error) go("/crm/scanner/markets", { error: error.message.includes("duplicate") ? "That city is already on your list." : error.message });
  revalidatePath("/crm/scanner/markets");
  go("/crm/scanner/markets", { saved: 1 });
}

export async function deleteMarket(fd: FormData) {
  const { supabase } = await requireRole("owner");
  await supabase.from("scan_markets").delete().eq("id", String(fd.get("id")));
  revalidatePath("/crm/scanner");
  go("/crm/scanner/markets", { deleted: 1 });
}
