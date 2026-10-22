"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { toNumber, toText } from "@/lib/format";

export async function saveAnalysis(fd: FormData) {
  const { supabase, profile } = await requireRole("owner", "acquisitions");
  const leadId = String(fd.get("lead_id"));
  const n = (k: string) => toNumber(fd.get(k));
  const arv = n("arv");
  const repairs = n("repairs") ?? 0;
  const pct = n("mao_pct") ?? 70;
  const fee = n("fee") ?? 0;
  const price = n("price");
  if (!arv) redirect(`/crm/analyzer?lead=${leadId}&error=${encodeURIComponent("Enter an ARV first.")}`);
  const mao = Math.round(arv * (pct / 100) - repairs - fee);
  const verdict = price === null ? null : price <= mao ? "GO" : "PASS";
  let comps: unknown = [];
  try {
    comps = JSON.parse(String(fd.get("comps_json") ?? "[]"));
  } catch {}

  const analysis = {
    arv, repairs, mao_pct: pct, fee, price, mao, verdict,
    sqft: n("sqft"), rehab_level: toText(fd.get("rehab_level")), comps,
    analyzed_at: new Date().toISOString(), analyzed_by: profile.full_name ?? profile.email,
  };
  const patch: Record<string, unknown> = { analysis, est_arv: arv, est_repairs: repairs };
  if (fd.get("set_offer") === "on") patch.offer_amount = mao;
  const { error } = await supabase.from("leads").update(patch).eq("id", leadId);
  if (error) redirect(`/crm/analyzer?lead=${leadId}&error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/crm/leads/${leadId}`);
  redirect(`/crm/leads/${leadId}?saved=1`);
}
