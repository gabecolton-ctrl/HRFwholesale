"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { LEAD_STATUSES } from "@/lib/constants";
import { addressKey, phoneDigits, toNumber, toText } from "@/lib/format";

export type LeadFormState = { error?: string; duplicateId?: string };

function readLead(fd: FormData) {
  const bool = (k: string) => fd.get(k) === "on";
  const monthly = fd.get("open_to_monthly_payments");
  const status = String(fd.get("status") ?? "New");
  return {
    seller_name: toText(fd.get("seller_name")),
    phone: phoneDigits(String(fd.get("phone") ?? "")) || null,
    email: toText(fd.get("email")),
    mailing_address: toText(fd.get("mailing_address")),
    address: toText(fd.get("address")),
    city: toText(fd.get("city")),
    zip: toText(fd.get("zip")),
    county: toText(fd.get("county")),
    property_type: toText(fd.get("property_type")),
    beds: toNumber(fd.get("beds")),
    baths: toNumber(fd.get("baths")),
    sqft: toNumber(fd.get("sqft")),
    year_built: toNumber(fd.get("year_built")),
    condition: toText(fd.get("condition")),
    occupancy: toText(fd.get("occupancy")),
    reason_for_selling: toText(fd.get("reason_for_selling")),
    timeline: toText(fd.get("timeline")),
    asking_price: toNumber(fd.get("asking_price")),
    motivation: toNumber(fd.get("motivation")),
    lead_source: toText(fd.get("lead_source")),
    est_arv: toNumber(fd.get("est_arv")),
    est_repairs: toNumber(fd.get("est_repairs")),
    mortgage_balance: toNumber(fd.get("mortgage_balance")),
    offer_amount: toNumber(fd.get("offer_amount")),
    low_rate_loan: bool("low_rate_loan"),
    free_and_clear: bool("free_and_clear"),
    tired_landlord: bool("tired_landlord"),
    keep_candidate: bool("keep_candidate"),
    open_to_monthly_payments: monthly === "yes" ? true : monthly === "no" ? false : null,
    do_not_call: bool("do_not_call"),
    status: (LEAD_STATUSES as readonly string[]).includes(status) ? status : "New",
    dead_reason: toText(fd.get("dead_reason")),
    next_follow_up: toText(fd.get("next_follow_up")),
    assigned_to: toText(fd.get("assigned_to")),
    notes: toText(fd.get("notes")),
  };
}

function friendly(msg: string) {
  return msg.replace(/^.*?(Callers cannot)/, "$1");
}

export async function createLead(_prev: LeadFormState, fd: FormData): Promise<LeadFormState> {
  const { supabase, user, profile } = await requireRole("owner", "acquisitions", "va");
  const v = readLead(fd);
  if (!v.seller_name || !v.address) return { error: "Seller name and property address are required." };

  // Duplicate check by normalized address (unless they confirmed).
  if (fd.get("allow_duplicate") !== "1") {
    const key = addressKey(v.address, v.zip);
    const { data: dup } = await supabase.from("leads").select("id").eq("address_key", key).limit(1).maybeSingle();
    if (dup) return { error: "A lead with this address already exists.", duplicateId: dup.id };
  }

  const row: Record<string, unknown> = { ...v, created_by: user.id };
  if (profile.role === "acquisitions" && !row.assigned_to) row.assigned_to = user.id;
  if (profile.role === "va") delete row.assigned_to;
  if (!row.next_follow_up) delete row.next_follow_up; // database applies the day-3 cadence

  const { data, error } = await supabase.from("leads").insert(row).select("id").single();
  if (error || !data) return { error: friendly(error?.message ?? "Could not save the lead.") };
  revalidatePath("/crm/leads");
  redirect(`/crm/leads/${data.id}?saved=1`);
}

export async function updateLead(_prev: LeadFormState, fd: FormData): Promise<LeadFormState> {
  const { supabase, profile } = await requireRole("owner", "acquisitions", "va");
  const id = String(fd.get("id"));
  const v: Record<string, unknown> = readLead(fd);
  if (!v.seller_name || !v.address) return { error: "Seller name and property address are required." };
  if (v.status === "Dead" && !v.dead_reason) return { error: "Add a short reason before marking a lead Dead." };
  if (profile.role === "va") {
    // Fields a caller can't change are left out entirely (the database also blocks them).
    for (const k of ["assigned_to", "offer_amount", "est_arv", "est_repairs"]) delete v[k];
  }
  if (!v.next_follow_up) delete v.next_follow_up;

  const { error } = await supabase.from("leads").update(v).eq("id", id);
  if (error) return { error: friendly(error.message) };
  revalidatePath(`/crm/leads/${id}`);
  redirect(`/crm/leads/${id}?saved=1`);
}

export async function logFollowUp(fd: FormData) {
  const { supabase } = await requireRole("owner", "acquisitions", "va");
  const id = String(fd.get("lead_id"));
  const back = String(fd.get("back") ?? `/crm/leads/${id}`);
  const { error } = await supabase.rpc("complete_follow_up", {
    p_lead_id: id,
    p_kind: String(fd.get("kind") ?? "call"),
    p_reached: fd.get("reached") === "on",
    p_outcome: toText(fd.get("outcome")),
    p_notes: toText(fd.get("notes")),
    p_next_date: toText(fd.get("next_date")),
  });
  const sep = back.includes("?") ? "&" : "?";
  if (error) redirect(`${back}${sep}error=${encodeURIComponent(error.message)}`);

  // Optional quick status change from the same form.
  const status = toText(fd.get("status"));
  if (status) {
    const { error: sErr } = await supabase.from("leads").update({ status }).eq("id", id);
    if (sErr) redirect(`${back}${sep}error=${encodeURIComponent(friendly(sErr.message))}`);
  }
  revalidatePath("/crm/follow-ups");
  revalidatePath(`/crm/leads/${id}`);
  redirect(`${back}${sep}logged=1`);
}

export async function deleteLead(fd: FormData) {
  const { supabase } = await requireRole("owner");
  const id = String(fd.get("id"));
  const { error } = await supabase.from("leads").delete().eq("id", id);
  if (error) redirect(`/crm/leads/${id}?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/crm/leads");
  redirect("/crm/leads?deleted=1");
}
