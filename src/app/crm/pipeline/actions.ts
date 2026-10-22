"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { DEAL_STATUSES, EXIT_STRATEGIES, REHAB_LEVELS } from "@/lib/constants";
import { toNumber, toText } from "@/lib/format";
import { checkUpload, uploadPrivate } from "@/lib/files";

export type DealFormState = { error?: string };

const TEXT = ["address", "city", "zip", "area", "property_type", "description", "title_company", "cancel_reason", "notes"];
const NUM = ["beds", "baths", "sqft", "year_built", "arv", "repair_estimate", "contract_price", "earnest_money", "option_fee", "assignment_price", "buyer_emd"];
const DATE = ["contract_signed_date", "option_period_end", "closing_date", "title_opened_date", "seller_disclosure_date", "buyer_disclosure_date"];
const IDS = ["end_buyer_id", "acq_rep", "dispo_rep", "lead_id"];
const BOOL = ["seller_disclosure_signed", "buyer_disclosure_signed", "published_to_portal", "buyer_emd_received"];

/** Only fields actually on the form are written, so a role that can't see a section never blanks it. */
function readDeal(fd: FormData) {
  const row: Record<string, unknown> = {};
  for (const k of TEXT) if (fd.has(k)) row[k] = toText(fd.get(k));
  for (const k of NUM) if (fd.has(k)) row[k] = toNumber(fd.get(k));
  for (const k of DATE) if (fd.has(k)) row[k] = toText(fd.get(k));
  for (const k of IDS) if (fd.has(k)) row[k] = toText(fd.get(k));
  const shownBoxes = String(fd.get("_checkboxes") ?? "").split(",");
  for (const k of BOOL) if (shownBoxes.includes(k)) row[k] = fd.get(k) === "on";
  if (fd.has("status")) {
    const s = String(fd.get("status"));
    if ((DEAL_STATUSES as readonly string[]).includes(s)) row.status = s;
  }
  if (fd.has("exit_strategy")) {
    const s = String(fd.get("exit_strategy"));
    if ((EXIT_STRATEGIES as readonly string[]).includes(s)) row.exit_strategy = s;
  }
  if (fd.has("rehab_level")) {
    const s = String(fd.get("rehab_level"));
    row.rehab_level = (REHAB_LEVELS as readonly string[]).includes(s) ? s : null;
  }
  // Ticking "signed" with no date uses today.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
  if (row.seller_disclosure_signed === true && !row.seller_disclosure_date) row.seller_disclosure_date = today;
  if (row.buyer_disclosure_signed === true && !row.buyer_disclosure_date) row.buyer_disclosure_date = today;
  return row;
}

function friendly(msg: string) {
  const m = msg.match(/RULE: (.*)$/);
  return m ? m[1].charAt(0).toUpperCase() + m[1].slice(1) + "." : msg;
}

async function attachDisclosures(fd: FormData, dealId: string) {
  const out: Record<string, string> = {};
  for (const side of ["seller", "buyer"] as const) {
    const file = fd.get(`${side}_disclosure_file`) as File | null;
    const err = checkUpload(file);
    if (err) throw new Error(`${side === "seller" ? "Seller" : "Buyer"} disclosure: ${err}`);
    if (file && file.size > 0) out[`${side}_disclosure_path`] = await uploadPrivate("disclosures", `${dealId}/${side}`, file);
  }
  return out;
}

export async function createDeal(_prev: DealFormState, fd: FormData): Promise<DealFormState> {
  const { supabase, user, profile } = await requireRole("owner", "acquisitions", "dispositions");
  const row = readDeal(fd);
  if (!row.address) return { error: "Property address is required." };
  row.created_by = user.id;
  if (profile.role === "acquisitions") row.acq_rep = user.id;
  else if (!row.acq_rep) row.acq_rep = null;

  // Save without the publish flag first so uploads can attach, then apply it.
  const wantPublish = row.published_to_portal === true;
  row.published_to_portal = false;
  const { data, error } = await supabase.from("deals").insert(row).select("id").single();
  if (error || !data) return { error: friendly(error?.message ?? "Could not save the deal.") };

  let problem: string | null = null;
  try {
    const files = await attachDisclosures(fd, data.id);
    const patch = { ...files, ...(wantPublish ? { published_to_portal: true } : {}) };
    if (Object.keys(patch).length) {
      const { error: e2 } = await supabase.from("deals").update(patch).eq("id", data.id);
      if (e2) problem = friendly(e2.message);
    }
  } catch (e) {
    problem = (e as Error).message;
  }
  revalidatePath("/crm/pipeline");
  if (problem) redirect(`/crm/pipeline/${data.id}?error=${encodeURIComponent("Deal saved, but: " + problem)}`);
  redirect(`/crm/pipeline/${data.id}?saved=1`);
}

export async function updateDeal(_prev: DealFormState, fd: FormData): Promise<DealFormState> {
  const { supabase } = await requireRole("owner", "acquisitions", "dispositions");
  const id = String(fd.get("id"));
  const row = readDeal(fd);
  if (fd.has("address") && !row.address) return { error: "Property address is required." };

  let files: Record<string, string> = {};
  try {
    files = await attachDisclosures(fd, id);
  } catch (e) {
    return { error: (e as Error).message };
  }
  const { error } = await supabase.from("deals").update({ ...row, ...files }).eq("id", id);
  if (error) return { error: friendly(error.message) };
  revalidatePath("/crm/pipeline");
  revalidatePath(`/crm/pipeline/${id}`);
  redirect(`/crm/pipeline/${id}?saved=1`);
}

export async function deleteDeal(fd: FormData) {
  const { supabase } = await requireRole("owner");
  const id = String(fd.get("id"));
  await supabase.from("deals").delete().eq("id", id);
  revalidatePath("/crm/pipeline");
  redirect("/crm/pipeline");
}
