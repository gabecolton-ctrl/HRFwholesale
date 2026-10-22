"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { toNumber, toText } from "@/lib/format";

export async function saveDefaults(fd: FormData) {
  const { supabase } = await requireRole("owner");
  const n = (k: string, fallback: number) => toNumber(fd.get(k)) ?? fallback;
  const pct = n("default_mao_pct", 70);
  if (pct <= 0 || pct > 100) redirect("/crm/settings?error=MAO+%25+must+be+between+1+and+100");
  const { error } = await supabase.from("app_settings").update({
    default_mao_pct: pct,
    default_fee: n("default_fee", 10000),
    rehab_turnkey_sqft: n("rehab_turnkey_sqft", 5),
    rehab_light_sqft: n("rehab_light_sqft", 20),
    rehab_medium_sqft: n("rehab_medium_sqft", 37.5),
    rehab_heavy_sqft: n("rehab_heavy_sqft", 55),
    updated_at: new Date().toISOString(),
  }).eq("id", 1);
  if (error) redirect(`/crm/settings?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/crm/settings");
  redirect("/crm/settings?saved=defaults");
}

const PLAYBOOK_CLOSINGS = [0, 0, 1, 1, 2, 2, 3, 3, 4, 5, 6, 7];

function monthsFrom(start: string, count = 12) {
  const [y, m] = start.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 + i, 1));
    return d.toISOString().slice(0, 10);
  });
}

export async function fillPlaybookTargets(fd: FormData) {
  const { supabase } = await requireRole("owner");
  const start = String(fd.get("start") ?? ""); // YYYY-MM
  if (!/^\d{4}-\d{2}$/.test(start)) redirect("/crm/settings?error=Pick+the+month+you+started");
  const avgFee = toNumber(fd.get("avg_fee")) ?? 12000;
  const rows = monthsFrom(start).map((month, i) => ({
    month,
    closings: PLAYBOOK_CLOSINGS[i],
    contracts: PLAYBOOK_CLOSINGS[Math.min(i + 1, 11)],
    revenue: PLAYBOOK_CLOSINGS[i] * avgFee,
    outreach: i === 0 ? 0 : Math.max(1100, PLAYBOOK_CLOSINGS[Math.min(i + 1, 11)] * 1070),
  }));
  const { error } = await supabase.from("monthly_targets").upsert(rows, { onConflict: "month" });
  if (error) redirect(`/crm/settings?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/crm/settings");
  revalidatePath("/crm/dashboard");
  redirect("/crm/settings?saved=targets#targets");
}

export async function saveTargets(fd: FormData) {
  const { supabase } = await requireRole("owner");
  const months = fd.getAll("month").map(String);
  const rows = months.map((month, i) => ({
    month,
    outreach: toNumber(fd.getAll("outreach")[i] as string),
    contracts: toNumber(fd.getAll("contracts")[i] as string),
    closings: toNumber(fd.getAll("closings")[i] as string),
    revenue: toNumber(fd.getAll("revenue")[i] as string),
  }));
  const { error } = await supabase.from("monthly_targets").upsert(rows, { onConflict: "month" });
  if (error) redirect(`/crm/settings?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/crm/dashboard");
  redirect("/crm/settings?saved=targets#targets");
}

export async function addSpend(fd: FormData) {
  const { supabase } = await requireRole("owner");
  const month = String(fd.get("month") ?? "");
  const source = toText(fd.get("lead_source"));
  const amount = toNumber(fd.get("amount"));
  if (!/^\d{4}-\d{2}$/.test(month) || !source || amount === null || amount < 0) redirect("/crm/settings?error=Enter+month%2C+source+and+amount#spend");
  const { error } = await supabase.from("marketing_spend").upsert(
    { month: `${month}-01`, lead_source: source, amount, notes: toText(fd.get("notes")) },
    { onConflict: "month,lead_source" },
  );
  if (error) redirect(`/crm/settings?error=${encodeURIComponent(error.message)}#spend`);
  revalidatePath("/crm/dashboard");
  redirect("/crm/settings?saved=spend#spend");
}

export async function deleteSpend(fd: FormData) {
  const { supabase } = await requireRole("owner");
  await supabase.from("marketing_spend").delete().eq("id", String(fd.get("id")));
  revalidatePath("/crm/settings");
  redirect("/crm/settings#spend");
}
