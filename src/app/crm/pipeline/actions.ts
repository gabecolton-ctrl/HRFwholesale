"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { DEAL_STATUSES, EXIT_STRATEGIES, REHAB_LEVELS } from "@/lib/constants";
import { toNumber, toText } from "@/lib/format";
import { checkUpload, uploadPrivate } from "@/lib/files";
import { sendDealAlerts } from "@/lib/alerts";
import { createAdminClient } from "@/lib/supabase/admin";

export type DealFormState = { error?: string };

const TEXT = ["address", "city", "zip", "area", "property_type", "description", "title_company", "cancel_reason", "notes"];
const NUM = ["beds", "baths", "sqft", "year_built", "arv", "repair_estimate", "contract_price", "earnest_money", "option_fee", "assignment_price", "buyer_emd", "list_price"];

type Comp = { address: string; sold_price: number | null; sold_date: string | null; beds: number | null; baths: number | null; sqft: number | null; distance: string | null };
function readComps(raw: FormDataEntryValue | null): Comp[] | undefined {
  if (raw === null) return undefined;
  try {
    const arr = JSON.parse(String(raw));
    if (!Array.isArray(arr)) return [];
    return arr
      .slice(0, 10)
      .map((c) => ({
        address: String(c.address ?? "").trim().slice(0, 200),
        sold_price: toNumber(c.sold_price),
        sold_date: toText(c.sold_date),
        beds: toNumber(c.beds),
        baths: toNumber(c.baths),
        sqft: toNumber(c.sqft),
        distance: toText(c.distance),
      }))
      .filter((c) => c.address || c.sold_price);
  } catch {
    return undefined;
  }
}
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
  const comps = readComps(fd.get("comps_json"));
  if (comps !== undefined) row.comps = comps;
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
  let note = "";
  if (wantPublish) {
    const r = await sendDealAlerts(data.id, "A").catch((e) => ({ sent: 0, failed: 0, skipped: 0, note: (e as Error).message }));
    note = r.sent ? `&alerted=${r.sent}` : r.note ? `&alertnote=${encodeURIComponent(r.note)}` : "";
  }
  redirect(`/crm/pipeline/${data.id}?saved=1${note}`);
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
  const { data: before } = await supabase.from("deals").select("published_to_portal").eq("id", id).single();
  const { error } = await supabase.from("deals").update({ ...row, ...files }).eq("id", id);
  if (error) return { error: friendly(error.message) };
  revalidatePath("/crm/pipeline");
  revalidatePath(`/crm/pipeline/${id}`);

  // Just published: email Tier A matching buyers first (playbook: best buyers first).
  let note = "";
  if (row.published_to_portal === true && before && !before.published_to_portal) {
    const r = await sendDealAlerts(id, "A").catch((e) => ({ sent: 0, failed: 0, skipped: 0, note: (e as Error).message }));
    note = r.sent ? `&alerted=${r.sent}` : r.note ? `&alertnote=${encodeURIComponent(r.note)}` : "";
  }
  redirect(`/crm/pipeline/${id}?saved=1${note}`);
}

export async function deleteDeal(fd: FormData) {
  const { supabase } = await requireRole("owner");
  const id = String(fd.get("id"));
  await supabase.from("deals").delete().eq("id", id);
  revalidatePath("/crm/pipeline");
  redirect("/crm/pipeline");
}

// ---------- Listing photos (uploaded straight from the browser to storage) ----------

const PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif" };

/** Issues short-lived upload links after confirming the user can edit this deal. */
export async function createPhotoUploads(dealId: string, files: { type: string; size: number }[]) {
  const { supabase } = await requireRole("owner", "acquisitions", "dispositions");
  const { data: deal } = await supabase.from("deals").select("id,photo_paths").eq("id", dealId).single();
  if (!deal) throw new Error("Deal not found");
  if ((deal.photo_paths?.length ?? 0) + files.length > 30) throw new Error("A deal can have up to 30 photos.");
  const admin = createAdminClient();
  const out: { path: string; token: string }[] = [];
  for (const f of files.slice(0, 30)) {
    const ext = PHOTO_TYPES[f.type];
    if (!ext) throw new Error("Photos must be JPG, PNG, WEBP or HEIC.");
    if (f.size > 20 * 1024 * 1024) throw new Error("Each photo must be under 20 MB.");
    const path = `${dealId}/${crypto.randomUUID()}.${ext}`;
    const { data, error } = await admin.storage.from("deal-photos").createSignedUploadUrl(path);
    if (error || !data) throw new Error(error?.message ?? "Could not prepare upload");
    out.push({ path, token: data.token });
  }
  return out;
}

export async function addDealPhotos(dealId: string, paths: string[]) {
  const { supabase } = await requireRole("owner", "acquisitions", "dispositions");
  const { data: deal } = await supabase.from("deals").select("photo_paths").eq("id", dealId).single();
  if (!deal) throw new Error("Deal not found");
  const clean = paths.filter((p) => p.startsWith(`${dealId}/`));
  const { error } = await supabase.from("deals").update({ photo_paths: [...(deal.photo_paths ?? []), ...clean] }).eq("id", dealId);
  if (error) throw new Error(error.message);
  revalidatePath(`/crm/pipeline/${dealId}`);
}

export async function updatePhotoOrder(fd: FormData) {
  const { supabase } = await requireRole("owner", "acquisitions", "dispositions");
  const dealId = String(fd.get("deal_id"));
  const path = String(fd.get("path"));
  const action = String(fd.get("action"));
  const { data: deal } = await supabase.from("deals").select("photo_paths").eq("id", dealId).single();
  if (!deal) redirect("/crm/pipeline");
  let list: string[] = deal.photo_paths ?? [];
  if (action === "cover") list = [path, ...list.filter((p) => p !== path)];
  if (action === "remove") list = list.filter((p) => p !== path);
  await supabase.from("deals").update({ photo_paths: list }).eq("id", dealId);
  if (action === "remove" && path.startsWith(`${dealId}/`)) await createAdminClient().storage.from("deal-photos").remove([path]);
  revalidatePath(`/crm/pipeline/${dealId}`);
  redirect(`/crm/pipeline/${dealId}#photos`);
}

// ---------- Alerts & offers ----------

export async function sendAlertsAction(fd: FormData) {
  const { supabase } = await requireRole("owner", "dispositions");
  const dealId = String(fd.get("deal_id"));
  const scope = fd.get("scope") === "A" ? "A" : "rest";
  const { data: deal } = await supabase.from("deals").select("id").eq("id", dealId).single();
  if (!deal) redirect("/crm/pipeline");
  const r = await sendDealAlerts(dealId, scope).catch((e) => ({ sent: 0, failed: 0, skipped: 0, note: (e as Error).message }));
  revalidatePath(`/crm/pipeline/${dealId}`);
  const q = r.sent ? `alerted=${r.sent}` : `alertnote=${encodeURIComponent(r.note || "Nothing to send.")}`;
  redirect(`/crm/pipeline/${dealId}?${q}${r.failed ? `&error=${encodeURIComponent(`${r.failed} alert emails failed`)}` : ""}#alerts`);
}

export async function setOfferStatus(fd: FormData) {
  const { supabase } = await requireRole("owner", "dispositions");
  const id = String(fd.get("id"));
  const dealId = String(fd.get("deal_id"));
  const status = String(fd.get("status"));
  if (!["New", "Reviewed", "Accepted", "Declined"].includes(status)) redirect(`/crm/pipeline/${dealId}`);
  await supabase.from("deal_offers").update({ status }).eq("id", id);
  revalidatePath(`/crm/pipeline/${dealId}`);
  redirect(`/crm/pipeline/${dealId}#offers`);
}
