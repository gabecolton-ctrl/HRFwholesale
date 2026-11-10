"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import type { Prospect } from "@/lib/prospects";

/** Saves one chunk of grouped prospects. Re-importing the same owner updates their numbers but keeps your decision. */
export async function saveProspects(chunk: Prospect[], fileName: string): Promise<{ saved: number; error?: string }> {
  const { supabase } = await requireRole("owner", "dispositions");
  const rows = chunk.slice(0, 500).map((p) => ({
    owner_key: String(p.owner_key).slice(0, 300),
    name: String(p.name).slice(0, 200),
    is_company: !!p.is_company,
    mailing_address: p.mailing_address?.slice(0, 300) ?? null,
    phones: (p.phones ?? []).slice(0, 10),
    emails: (p.emails ?? []).slice(0, 5),
    purchases: Number(p.purchases) || 0,
    purchases_12mo: Number(p.purchases_12mo) || 0,
    last_purchase: p.last_purchase,
    price_min: p.price_min,
    price_max: p.price_max,
    avg_price: p.avg_price,
    zips: (p.zips ?? []).slice(0, 8),
    cities: (p.cities ?? []).slice(0, 5),
    property_types: (p.property_types ?? []).slice(0, 4),
    properties: (p.properties ?? []).slice(0, 25),
    score: Math.max(0, Math.min(100, Number(p.score) || 0)),
    suggested_tier: ["A", "B", "C"].includes(p.suggested_tier) ? p.suggested_tier : "C",
    source_file: fileName.slice(0, 200),
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase.from("buyer_prospects").upsert(rows, { onConflict: "owner_key" });
  if (error) return { saved: 0, error: error.message };
  revalidatePath("/crm/buyers/prospects");
  return { saved: rows.length };
}

type P = {
  id: string; name: string; is_company: boolean; mailing_address: string | null; phones: { number: string; type: string; dnc: boolean }[]; emails: string[];
  purchases: number; purchases_12mo: number; last_purchase: string | null; price_min: number | null; price_max: number | null;
  zips: string[]; cities: string[]; property_types: string[]; suggested_tier: "A" | "B" | "C"; status: string;
};

const back = (fd: FormData) => {
  const b = String(fd.get("back") ?? "/crm/buyers/prospects");
  return b.startsWith("/crm/buyers/prospects") ? b : "/crm/buyers/prospects";
};
const withParams = (path: string, add: Record<string, string | number>) => {
  const u = new URL(path, "http://x");
  for (const [k, v] of Object.entries(add)) u.searchParams.set(k, String(v));
  return `${u.pathname}${u.search}`;
};

/** Moves checked prospects into the buyers list (skips anyone already there by email, phone or name). */
export async function addProspectsToBuyers(fd: FormData) {
  const { supabase, user } = await requireRole("owner", "dispositions");
  const ids = fd.getAll("ids").map(String).filter(Boolean).slice(0, 300);
  const b = back(fd);
  if (!ids.length) redirect(withParams(b, { error: "Check at least one prospect first." }));
  const alerts = fd.get("email_alerts") === "on";

  const { data } = await supabase.from("buyer_prospects").select("*").in("id", ids).neq("status", "added");
  const list = (data ?? []) as P[];
  const { data: existing } = await supabase.from("cash_buyers").select("id,name,phone,email");
  const byEmail = new Map((existing ?? []).filter((x) => x.email).map((x) => [String(x.email).toLowerCase(), x.id as string]));
  const byPhone = new Map((existing ?? []).filter((x) => x.phone).map((x) => [String(x.phone).replace(/\D/g, "").slice(-10), x.id as string]));
  const byName = new Map((existing ?? []).map((x) => [String(x.name).toLowerCase().replace(/[^a-z0-9]/g, ""), x.id as string]));

  let added = 0, linked = 0;
  for (const p of list) {
    const phone = p.phones.find((x) => !x.dnc)?.number ?? null;
    const email = p.emails[0] ?? null;
    let buyerId =
      p.emails.map((e) => byEmail.get(e.toLowerCase())).find(Boolean) ??
      p.phones.map((x) => byPhone.get(x.number)).find(Boolean) ??
      byName.get(p.name.toLowerCase().replace(/[^a-z0-9]/g, ""));
    if (buyerId) linked++;
    else {
      const floor = (n: number | null) => (n == null ? null : Math.max(0, Math.floor((n * 0.85) / 10000) * 10000));
      const ceil = (n: number | null) => (n == null ? null : Math.ceil((n * 1.15) / 10000) * 10000);
      const notes = [
        `Imported from PropStream: ${p.purchases} purchase${p.purchases === 1 ? "" : "s"} on file, ${p.purchases_12mo} in the last 12 months${p.last_purchase ? `, most recent ${p.last_purchase}` : ""}.`,
        p.mailing_address ? `Mailing address: ${p.mailing_address}` : "",
        p.phones.length > 1 ? `Other phones: ${p.phones.filter((x) => x.number !== phone).map((x) => `${x.number}${x.dnc ? " (DNC)" : ""}`).join(", ")}` : "",
        "Buy box was estimated from past purchases. Confirm it on your first call.",
      ].filter(Boolean).join("\n");
      const row = {
        name: p.name,
        company: p.is_company ? p.name : null,
        phone,
        email,
        areas: [...p.zips.slice(0, 5), ...p.cities.slice(0, 3)],
        price_min: floor(p.price_min),
        price_max: ceil(p.price_max),
        property_types: p.property_types,
        tier: p.suggested_tier,
        source: "PropStream",
        status: "Active",
        email_alerts: alerts && !!email,
        notes,
        created_by: user.id,
      };
      const { data: ins, error } = await supabase.from("cash_buyers").insert(row).select("id").single();
      if (error || !ins) redirect(withParams(b, { error: `Stopped at ${p.name}: ${error?.message ?? "couldn't add"}`, added }));
      buyerId = ins.id as string;
      if (email) byEmail.set(email.toLowerCase(), buyerId);
      added++;
    }
    await supabase.from("buyer_prospects").update({ status: "added", buyer_id: buyerId }).eq("id", p.id);
  }
  revalidatePath("/crm/buyers");
  revalidatePath("/crm/buyers/prospects");
  redirect(withParams(b, { added, linked }));
}

export async function setProspectStatus(fd: FormData) {
  const { supabase } = await requireRole("owner", "dispositions");
  const ids = fd.getAll("ids").map(String).filter(Boolean).slice(0, 1000);
  const to = fd.get("to") === "new" ? "new" : "rejected";
  const b = back(fd);
  if (!ids.length) redirect(withParams(b, { error: "Check at least one prospect first." }));
  await supabase.from("buyer_prospects").update({ status: to }).in("id", ids).neq("status", "added");
  revalidatePath("/crm/buyers/prospects");
  redirect(withParams(b, { [to === "new" ? "restored" : "rejected"]: ids.length }));
}
