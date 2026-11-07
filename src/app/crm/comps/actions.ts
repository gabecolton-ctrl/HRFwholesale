"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { toNumber, toText } from "@/lib/format";
import { compsKey, fetchComps, MONTHLY_LIMIT } from "@/lib/rentcast";

const RADII = ["0.5", "1", "2"];

function back(params: Record<string, string | null | undefined>): never {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  redirect(`/crm/comps${q.size ? `?${q}` : ""}`);
}

/** Look up comps for an address. Re-uses a lookup of the same address from the last 30 days (no API call). */
export async function pullComps(fd: FormData) {
  const { supabase } = await requireRole("owner", "acquisitions", "dispositions");
  const address = (toText(fd.get("address")) ?? "").replace(/\s+/g, " ").trim();
  const radius = RADII.includes(String(fd.get("radius"))) ? String(fd.get("radius")) : "1";
  const lead = toText(fd.get("lead_id"));
  const sqft = toNumber(fd.get("sqft"));
  const beds = toNumber(fd.get("beds"));
  const baths = toNumber(fd.get("baths"));
  const refresh = fd.get("refresh") === "1";
  if (address.length < 8 || !/\d/.test(address)) back({ lead, error: "Enter the full address: street, city, state and ZIP.", address });

  const key = compsKey(address, radius);
  if (!refresh && !sqft && !beds && !baths) {
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const { data: hit } = await supabase.from("comp_lookups").select("id").eq("address_key", key).gte("created_at", since).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (hit) back({ id: hit.id, lead, cached: "1" });
  }

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const { count } = await supabase.from("comp_lookups").select("id", { count: "exact", head: true }).gte("created_at", monthStart.toISOString());
  if ((count ?? 0) >= MONTHLY_LIMIT) {
    back({ lead, address, error: `You've used all ${MONTHLY_LIMIT} lookups this month. Re-open a past lookup below, or raise RENTCAST_MONTHLY_LIMIT after upgrading your RentCast plan.` });
  }

  let result;
  try {
    result = await fetchComps({ address, radius: Number(radius), sqft, beds, baths });
  } catch (e) {
    back({ lead, address, error: (e as Error).message });
  }

  const { data: row, error } = await supabase
    .from("comp_lookups")
    .insert({ address_key: key, query: { address, radius, sqft, beds, baths }, result, lead_id: lead })
    .select("id")
    .single();
  if (error || !row) back({ lead, address, error: error?.message ?? "Couldn't save the lookup." });
  revalidatePath("/crm/comps");
  back({ id: row.id, lead });
}

/** Send the checked comps + ARV to a lead's Deal Analyzer. */
export async function useCompsOnLead(fd: FormData) {
  const { supabase } = await requireRole("owner", "acquisitions");
  const leadId = String(fd.get("lead_id") ?? "");
  const lookupId = toText(fd.get("lookup_id"));
  if (!leadId) back({ id: lookupId, error: "Pick a lead first." });
  const arv = toNumber(fd.get("arv"));
  const sqft = toNumber(fd.get("sqft"));
  let comps: Record<string, unknown>[] = [];
  try {
    comps = JSON.parse(String(fd.get("comps_json") ?? "[]"));
  } catch {}
  const keep = ["address", "sold_price", "sold_date", "beds", "baths", "sqft", "distance", "condition"];
  comps = comps.slice(0, 10).map((c) => Object.fromEntries(keep.map((k) => [k, c[k] ?? ""])));

  const { data: lead } = await supabase.from("leads").select("id,analysis,sqft").eq("id", leadId).maybeSingle();
  if (!lead) back({ id: lookupId, error: "That lead wasn't found (or you don't have access to it)." });

  const analysis = { ...((lead.analysis ?? {}) as Record<string, unknown>), comps, ...(arv ? { arv } : {}), ...(sqft ? { sqft } : {}), comps_source: "RentCast list prices" };
  const patch: Record<string, unknown> = { analysis };
  if (arv) patch.est_arv = arv;
  if (sqft && !lead.sqft) patch.sqft = sqft;
  const { error } = await supabase.from("leads").update(patch).eq("id", leadId);
  if (error) back({ id: lookupId, lead: leadId, error: error.message });
  revalidatePath(`/crm/leads/${leadId}`);
  redirect(`/crm/analyzer?lead=${leadId}`);
}
