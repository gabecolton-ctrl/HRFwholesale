"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { PROPERTY_TYPES, REHAB_LEVELS, STRATEGIES } from "@/lib/constants";
import { phoneDigits, toList, toNumber, toText } from "@/lib/format";
import { checkUpload, uploadPrivate } from "@/lib/files";
import { createAdminClient } from "@/lib/supabase/admin";

function readBuyer(fd: FormData) {
  const pick = (n: string, allowed: readonly string[]) => fd.getAll(n).map(String).filter((x) => allowed.includes(x));
  const tier = String(fd.get("tier") ?? "B");
  return {
    name: toText(fd.get("name")),
    company: toText(fd.get("company")),
    phone: phoneDigits(String(fd.get("phone") ?? "")) || null,
    email: toText(fd.get("email"))?.toLowerCase() ?? null,
    areas: toList(String(fd.get("areas") ?? "")),
    price_min: toNumber(fd.get("price_min")),
    price_max: toNumber(fd.get("price_max")),
    property_types: pick("property_types", PROPERTY_TYPES),
    rehab_levels: pick("rehab_levels", REHAB_LEVELS),
    strategies: pick("strategies", STRATEGIES),
    tier: ["A", "B", "C"].includes(tier) ? tier : "B",
    source: toText(fd.get("source")),
    status: fd.get("status") === "Inactive" ? "Inactive" : "Active",
    pof_verified: fd.get("pof_verified") === "on",
    pof_amount: toNumber(fd.get("pof_amount")),
    email_alerts: fd.get("email_alerts") === "on",
    notes: toText(fd.get("notes")),
  };
}

async function maybeUploadPof(fd: FormData, buyerId: string) {
  const file = fd.get("pof") as File | null;
  const err = checkUpload(file);
  if (err) return err;
  if (file && file.size > 0) {
    const path = await uploadPrivate("proof-of-funds", `staff/${buyerId}`, file);
    await createAdminClient().from("cash_buyers").update({ pof_path: path, pof_uploaded_at: new Date().toISOString() }).eq("id", buyerId);
  }
  return null;
}

export async function saveBuyer(fd: FormData) {
  const { supabase, user } = await requireRole("owner", "dispositions");
  const id = toText(fd.get("id"));
  const v = readBuyer(fd);
  const back = id ? `/crm/buyers/${id}` : "/crm/buyers/new";
  if (!v.name) redirect(`${back}?error=Name+is+required`);
  if (v.price_min !== null && v.price_max !== null && v.price_min > v.price_max) redirect(`${back}?error=Min+price+is+above+max+price`);

  let buyerId = id;
  if (id) {
    const { error } = await supabase.from("cash_buyers").update(v).eq("id", id);
    if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}`);
  } else {
    const { data, error } = await supabase.from("cash_buyers").insert({ ...v, created_by: user.id }).select("id").single();
    if (error || !data) redirect(`${back}?error=${encodeURIComponent(error?.message ?? "Could not save")}`);
    buyerId = data.id;
  }
  const upErr = await maybeUploadPof(fd, buyerId!);
  revalidatePath("/crm/buyers");
  redirect(`/crm/buyers/${buyerId}?${upErr ? "error=" + encodeURIComponent(upErr) : "saved=1"}`);
}

export async function deleteBuyer(fd: FormData) {
  const { supabase } = await requireRole("owner");
  const id = String(fd.get("id"));
  const { error } = await supabase.from("cash_buyers").delete().eq("id", id);
  if (error) redirect(`/crm/buyers/${id}?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/crm/buyers");
  redirect("/crm/buyers?deleted=1");
}
