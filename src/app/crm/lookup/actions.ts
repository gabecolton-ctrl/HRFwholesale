"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireRole } from "@/lib/auth";
import { addressKey, toNumber, toText } from "@/lib/format";
import { LOOKUP_LIMIT, bestPhone, lookupKey, lookupProperty, splitAddress, type PropertyData } from "@/lib/tracerfy";

const ROLES = ["owner", "acquisitions", "va"] as const;

function back(params: Record<string, string | null | undefined>): never {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  redirect(`/crm/lookup${q.size ? `?${q}` : ""}`);
}

function monthStartIso() {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Saves the lookup on a lead, and fills in any blank lead fields (never overwrites what you typed). */
async function applyToLead(supabase: SupabaseClient, leadId: string, d: PropertyData) {
  const { data: lead } = await supabase
    .from("leads")
    .select("id,phone,email,mailing_address,county,beds,baths,sqft,year_built,mortgage_balance,free_and_clear")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead) return "That lead wasn't found (or you don't have access to it).";
  const p = d.property;
  const patch: Record<string, unknown> = { property_data: d };
  const fill = (k: string, v: unknown) => {
    if ((lead as Record<string, unknown>)[k] == null && v != null && v !== "") patch[k] = v;
  };
  fill("phone", bestPhone(d));
  fill("email", d.emails[0]);
  fill("mailing_address", d.mailing_address);
  fill("county", p.county);
  fill("beds", p.beds);
  fill("baths", p.baths);
  fill("sqft", p.sqft);
  fill("year_built", p.year_built);
  fill("mortgage_balance", p.open_mortgage_balance);
  if (p.free_clear && !lead.free_and_clear) patch.free_and_clear = true;
  const { error } = await supabase.from("leads").update(patch).eq("id", leadId);
  if (error) return error.message;
  revalidatePath(`/crm/leads/${leadId}`);
  return null;
}

/** Look up owner, mortgage and contact info. Same address within 30 days = no new charge. */
export async function runLookup(fd: FormData) {
  const { supabase } = await requireRole(...ROLES);
  const lead = toText(fd.get("lead_id"));
  let a = {
    address: (toText(fd.get("address")) ?? "").replace(/\s+/g, " ").trim(),
    city: (toText(fd.get("city")) ?? "").trim(),
    state: (toText(fd.get("state")) ?? "").trim().toUpperCase(),
    zip: (toText(fd.get("zip")) ?? "").trim(),
  };
  if (!a.city) {
    const s = splitAddress(a.address);
    if (s) a = { ...s, zip: s.zip || a.zip };
  }
  const echo = { lead, address: a.address, city: a.city, state: a.state, zip: a.zip };
  if (!a.address || !a.city || !/^[A-Z]{2}$/.test(a.state)) back({ ...echo, error: "Enter the street, city and 2-letter state (ZIP helps too)." });

  const key = lookupKey(a);
  if (fd.get("refresh") !== "1") {
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const { data: hit } = await supabase.from("property_lookups").select("id,result").eq("address_key", key).gt("credits", 0).gte("created_at", since).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (hit) {
      if (lead) {
        const err = await applyToLead(supabase, lead, hit.result as PropertyData);
        if (err) back({ id: hit.id, lead, error: err });
      }
      back({ id: hit.id, lead, cached: "1" });
    }
  }

  const { count } = await supabase.from("property_lookups").select("id", { count: "exact", head: true }).gt("credits", 0).gte("created_at", monthStartIso());
  if ((count ?? 0) >= LOOKUP_LIMIT) {
    back({ ...echo, error: `You've hit this month's cap of ${LOOKUP_LIMIT} lookups. Raise TRACERFY_MONTHLY_LIMIT in Vercel if you want more.` });
  }

  let result: PropertyData;
  try {
    result = await lookupProperty(a);
  } catch (e) {
    back({ ...echo, error: (e as Error).message });
  }

  const { data: row, error } = await supabase
    .from("property_lookups")
    .insert({ address_key: key, query: a, result, credits: result.credits, lead_id: lead })
    .select("id")
    .single();
  if (error || !row) back({ ...echo, error: error?.message ?? "Couldn't save the lookup." });
  if (!result.hit) back({ ...echo, error: "No record found for that address (no charge). Check the spelling, or try without the unit number." });

  if (lead) {
    const err = await applyToLead(supabase, lead, result);
    if (err) back({ id: row.id, lead, error: err });
  }
  revalidatePath("/crm/lookup");
  back({ id: row.id, lead });
}

/** Turn a lookup (e.g. a Zillow house) into a lead with the owner and best phone filled in. */
export async function createLeadFromLookup(fd: FormData) {
  const { supabase, user, profile } = await requireRole(...ROLES);
  const id = String(fd.get("lookup_id") ?? "");
  const { data: lk } = await supabase.from("property_lookups").select("id,query,result").eq("id", id).maybeSingle();
  if (!lk) back({ error: "That lookup wasn't found." });
  const q = lk.query as { address: string; city: string; state: string; zip: string };
  const d = lk.result as PropertyData;

  if (fd.get("allow_duplicate") !== "1") {
    const { data: dup } = await supabase.from("leads").select("id").eq("address_key", addressKey(q.address, q.zip || null)).limit(1).maybeSingle();
    if (dup) redirect(`/crm/lookup?id=${id}&dup=${dup.id}`);
  }

  const p = d.property;
  const row: Record<string, unknown> = {
    seller_name: d.owners[0] ?? "Owner (unknown)",
    phone: bestPhone(d),
    email: d.emails[0] ?? null,
    mailing_address: d.mailing_address || null,
    address: q.address,
    city: q.city,
    state: q.state,
    zip: q.zip || null,
    county: p.county || null,
    beds: p.beds,
    baths: p.baths,
    sqft: p.sqft,
    year_built: p.year_built,
    occupancy: p.vacant ? "Vacant" : p.owner_occupied ? "Owner occupied" : null,
    mortgage_balance: p.open_mortgage_balance,
    free_and_clear: p.free_clear,
    asking_price: toNumber(fd.get("asking_price")),
    lead_source: toText(fd.get("lead_source")) ?? "Zillow",
    property_data: d,
    created_by: user.id,
  };
  if (profile.role === "acquisitions") row.assigned_to = user.id;
  const { data, error } = await supabase.from("leads").insert(row).select("id").single();
  if (error || !data) back({ id, error: error?.message ?? "Couldn't create the lead." });
  revalidatePath("/crm/leads");
  redirect(`/crm/leads/${data.id}?saved=1`);
}

/** Copy an existing lookup onto a lead (used from the results screen). */
export async function saveLookupToLead(fd: FormData) {
  const { supabase } = await requireRole(...ROLES);
  const id = String(fd.get("lookup_id") ?? "");
  const lead = String(fd.get("lead_id") ?? "");
  const { data: lk } = await supabase.from("property_lookups").select("result").eq("id", id).maybeSingle();
  if (!lk || !lead) back({ id, error: "Couldn't find that lookup or lead." });
  const err = await applyToLead(supabase, lead, lk.result as PropertyData);
  if (err) back({ id, lead, error: err });
  redirect(`/crm/leads/${lead}?saved=1`);
}
