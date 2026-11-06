"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { toText } from "@/lib/format";
import { pullFeed, detectFields, type Feed } from "@/lib/socrata";
import { syncList, type LeadList } from "@/lib/distress";
import { bestPhone, executeList, previewList, type ListRequest, type PropertyData } from "@/lib/tracerfy";

function go(path: string, params: Record<string, string | number | null | undefined> = {}): never {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== "") q.set(k, String(v));
  redirect(`${path}${q.size ? `?${q}` : ""}`);
}
const backTo = (fd: FormData) => {
  const b = String(fd.get("back") ?? "/crm/distress");
  return b.startsWith("/crm/distress") ? b : "/crm/distress";
};
const withParams = (path: string, add: Record<string, string | number>) => {
  const u = new URL(path, "http://x");
  for (const [k, v] of Object.entries(add)) u.searchParams.set(k, String(v));
  return `${u.pathname}${u.search}`;
};

/* ───────────── Inbox ───────────── */

type Signal = {
  id: string; source: "feed" | "list"; signal_type: string; address: string; city: string | null; state: string | null; zip: string | null;
  property_data: PropertyData | null; address_key: string; status: string;
};

export async function makeLeads(fd: FormData) {
  const { supabase, user, profile } = await requireRole("owner", "acquisitions", "va");
  const ids = fd.getAll("ids").map(String).filter(Boolean).slice(0, 200);
  const back = backTo(fd);
  if (!ids.length) redirect(withParams(back, { error: "Check at least one property first." }));

  const { data } = await supabase.from("distress_signals").select("id,source,signal_type,address,city,state,zip,property_data,address_key,status").in("id", ids);
  const signals = ((data ?? []) as Signal[]).filter((s) => s.status !== "lead");
  const keys = signals.map((s) => s.address_key);
  const { data: existing } = keys.length ? await supabase.from("leads").select("id,address_key").in("address_key", keys) : { data: [] };
  const byKey = new Map((existing ?? []).map((l) => [l.address_key as string, l.id as string]));

  let made = 0, linked = 0;
  for (const s of signals) {
    let leadId = byKey.get(s.address_key);
    if (leadId) {
      linked++;
      if (s.property_data) await supabase.from("leads").update({ property_data: s.property_data }).eq("id", leadId).is("property_data", null);
    } else {
      const d = s.property_data;
      const p = d?.property;
      const row: Record<string, unknown> = {
        seller_name: d?.owners[0] ?? "Owner (unknown)",
        phone: d ? bestPhone(d) : null,
        email: d?.emails[0] ?? null,
        mailing_address: d?.mailing_address || null,
        address: s.address,
        city: s.city,
        state: s.state ?? "TX",
        zip: s.zip,
        county: p?.county || null,
        beds: p?.beds ?? null,
        baths: p?.baths ?? null,
        sqft: p?.sqft ?? null,
        year_built: p?.year_built ?? null,
        occupancy: p?.vacant ? "Vacant" : p?.owner_occupied ? "Owner occupied" : null,
        mortgage_balance: p?.open_mortgage_balance ?? null,
        free_and_clear: p?.free_clear ?? false,
        reason_for_selling: s.signal_type,
        lead_source: s.source === "feed" ? "Code violations" : "Distress list",
        property_data: d,
        created_by: user.id,
      };
      if (profile.role === "acquisitions") row.assigned_to = user.id;
      const { data: ins, error } = await supabase.from("leads").insert(row).select("id").single();
      if (error || !ins) redirect(withParams(back, { error: `Stopped at ${s.address}: ${error?.message ?? "couldn't create the lead"}`, made }));
      leadId = ins.id as string;
      byKey.set(s.address_key, leadId);
      made++;
    }
    await supabase.from("distress_signals").update({ status: "lead", lead_id: leadId }).eq("id", s.id);
  }
  revalidatePath("/crm/leads");
  revalidatePath("/crm/distress");
  redirect(withParams(back, { made, linked }));
}

export async function setSignalStatus(fd: FormData) {
  const { supabase } = await requireRole("owner", "acquisitions", "va");
  const ids = fd.getAll("ids").map(String).filter(Boolean).slice(0, 500);
  const to = fd.get("to") === "new" ? "new" : "dismissed";
  const back = backTo(fd);
  if (!ids.length) redirect(withParams(back, { error: "Check at least one property first." }));
  await supabase.from("distress_signals").update({ status: to }).in("id", ids).neq("status", "lead");
  revalidatePath("/crm/distress");
  redirect(withParams(back, { [to === "new" ? "restored" : "dismissed"]: ids.length }));
}

/* ───────────── Lists (Tracerfy) ───────────── */

const TOGGLES = ["vacant", "pre_foreclosure", "absentee_owner", "high_equity", "free_clear", "out_of_state_owner", "corporate_owned"] as const;

function buildRequest(fd: FormData): { req: ListRequest; label: string } | { error: string } {
  const strategy = toText(fd.get("strategy")) ?? "custom";
  const state = (toText(fd.get("state")) ?? "").toUpperCase();
  const counties = (toText(fd.get("counties")) ?? "").split(/[,\n]/).map((c) => c.replace(/\s+county$/i, "").trim()).filter(Boolean);
  const zips = (toText(fd.get("zips")) ?? "").split(/[^\d]+/).filter((z) => /^\d{5}$/.test(z));
  const count = Math.min(Math.max(Number(fd.get("count")) || 100, 1), 5000);

  let geography: Record<string, unknown>;
  let where: string;
  if (zips.length) {
    geography = { mode: "zips", zip_codes: zips };
    where = `ZIP ${zips.slice(0, 3).join(", ")}${zips.length > 3 ? "…" : ""}`;
  } else if (!/^[A-Z]{2}$/.test(state)) {
    return { error: "Pick a state (or enter ZIP codes)." };
  } else if (counties.length) {
    geography = { mode: "counties", counties, states: [state] };
    where = `${counties.join(", ")} County, ${state}`;
  } else {
    geography = { mode: "states", states: [state] };
    where = state;
  }

  const filter_overrides: Record<string, unknown> = {};
  for (const t of TOGGLES) if (fd.get(t) === "on") filter_overrides[t] = true;
  if (fd.get("sfr_only") === "on") filter_overrides.property_types = ["SFR"];
  const label = `${String(fd.get("strategy_label") ?? strategy)} · ${where}`;
  return { req: { strategy, geography, filter_overrides, requested_count: count, name: `H.R.F ${label}`.slice(0, 120) }, label };
}

export type PreviewState = { total?: number; capped?: number; maxCredits?: number; error?: string; at?: number };

export async function previewListAction(_prev: PreviewState, fd: FormData): Promise<PreviewState> {
  await requireRole("owner", "acquisitions");
  const b = buildRequest(fd);
  if ("error" in b) return { error: b.error };
  try {
    const p = await previewList(b.req);
    return { total: p.total, capped: p.capped, maxCredits: p.maxCredits, at: Date.now() };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function buyListAction(fd: FormData) {
  const { supabase } = await requireRole("owner", "acquisitions");
  const b = buildRequest(fd);
  if ("error" in b) go("/crm/distress/lists", { error: b.error });
  let started: { id: string; maxCredits: number };
  try {
    started = await executeList(b.req);
  } catch (e) {
    go("/crm/distress/lists", { error: (e as Error).message });
  }
  const { error } = await supabase.from("lead_lists").insert({
    name: b.label,
    strategy: b.req.strategy,
    geography: b.req.geography,
    filters: b.req.filter_overrides,
    requested_count: b.req.requested_count,
    tracerfy_id: started.id,
    status: "processing",
  });
  if (error) go("/crm/distress/lists", { error: `The list started at Tracerfy (#${started.id}) but couldn't be saved here: ${error.message}` });
  revalidatePath("/crm/distress/lists");
  go("/crm/distress/lists", { started: 1 });
}

export async function refreshLists() {
  const { supabase } = await requireRole("owner", "acquisitions");
  const { data } = await supabase.from("lead_lists").select("*").in("status", ["processing", "completed"]);
  let imported = 0;
  for (const l of (data ?? []) as LeadList[]) {
    const after = await syncList(supabase, l);
    if (after.status === "imported") imported += after.rows_imported;
  }
  revalidatePath("/crm/distress");
  go("/crm/distress/lists", imported ? { imported } : { checked: 1 });
}

/* ───────────── City feeds (owner) ───────────── */

function parseDataset(input: string): { domain: string; dataset: string } | null {
  const s = input.trim();
  const m = s.match(/^(?:https?:\/\/)?([^/\s]+)\/.*?\b([a-z0-9]{4}-[a-z0-9]{4})\b/i);
  return m ? { domain: m[1].toLowerCase(), dataset: m[2].toLowerCase() } : null;
}

export async function addFeed(fd: FormData) {
  const { supabase } = await requireRole("owner");
  const link = parseDataset(String(fd.get("link") ?? ""));
  const city = toText(fd.get("city"));
  const state = (toText(fd.get("state")) ?? "").toUpperCase();
  if (!link) go("/crm/distress/feeds", { error: "Paste the dataset's web address from the city's open-data site (it ends in an ID like abcd-1234)." });
  if (!city || !/^[A-Z]{2}$/.test(state)) go("/crm/distress/feeds", { error: "Enter the city and its 2-letter state." });
  let fields;
  try {
    fields = await detectFields(link.domain, link.dataset);
  } catch (e) {
    go("/crm/distress/feeds", { error: (e as Error).message });
  }
  const keywords = (toText(fd.get("keywords")) ?? "").split(",").map((k) => k.trim().toLowerCase()).filter(Boolean);
  const { error } = await supabase.from("signal_feeds").insert({
    name: toText(fd.get("name")) ?? `${city} code complaints`,
    city, state, domain: link.domain, dataset_id: link.dataset, keywords,
    field_address: fields.address, field_type: fields.type, field_date: fields.date, field_zip: fields.zip, field_id: fields.id,
  });
  if (error) go("/crm/distress/feeds", { error: error.message.includes("duplicate") ? "That dataset is already added." : error.message });
  revalidatePath("/crm/distress/feeds");
  go("/crm/distress/feeds", { added: 1 });
}

export async function updateFeed(fd: FormData) {
  const { supabase } = await requireRole("owner");
  const id = String(fd.get("id"));
  const f = (k: string) => toText(fd.get(k));
  const patch: Record<string, unknown> = {
    name: f("name") ?? "Feed",
    keywords: (f("keywords") ?? "").split(",").map((k) => k.trim().toLowerCase()).filter(Boolean),
    active: fd.get("active") === "on",
    field_address: f("field_address"), field_type: f("field_type"), field_date: f("field_date"), field_zip: f("field_zip"), field_id: f("field_id"),
  };
  const { error } = await supabase.from("signal_feeds").update(patch).eq("id", id);
  if (error) go("/crm/distress/feeds", { error: error.message });
  revalidatePath("/crm/distress/feeds");
  go("/crm/distress/feeds", { saved: 1 });
}

export async function deleteFeed(fd: FormData) {
  const { supabase } = await requireRole("owner");
  await supabase.from("signal_feeds").delete().eq("id", String(fd.get("id")));
  revalidatePath("/crm/distress/feeds");
  go("/crm/distress/feeds", { deleted: 1 });
}

export async function pullFeedNow(fd: FormData) {
  const { supabase } = await requireRole("owner");
  const { data: feed } = await supabase.from("signal_feeds").select("*").eq("id", String(fd.get("id"))).maybeSingle();
  if (!feed) go("/crm/distress/feeds", { error: "Feed not found." });
  try {
    const r = await pullFeed(supabase, feed as Feed);
    revalidatePath("/crm/distress");
    go("/crm/distress/feeds", { pulled: r.added, scanned: r.scanned });
  } catch (e) {
    if ((e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw e;
    go("/crm/distress/feeds", { error: (e as Error).message });
  }
}
