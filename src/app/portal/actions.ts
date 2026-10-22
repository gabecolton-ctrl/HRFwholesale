"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { checkUpload, uploadPrivate } from "@/lib/files";
import { phoneDigits, toList, toNumber, toText } from "@/lib/format";
import { PROPERTY_TYPES, REHAB_LEVELS, STRATEGIES } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";

export async function updateBuyBox(fd: FormData) {
  const { supabase, user } = await requireRole("buyer");
  const pick = (n: string, allowed: readonly string[]) => fd.getAll(n).map(String).filter((x) => allowed.includes(x));
  const { error } = await supabase
    .from("cash_buyers")
    .update({
      name: toText(fd.get("name")) ?? undefined,
      company: toText(fd.get("company")),
      phone: phoneDigits(String(fd.get("phone") ?? "")) || null,
      areas: toList(String(fd.get("areas") ?? "")),
      price_min: toNumber(fd.get("price_min")),
      price_max: toNumber(fd.get("price_max")),
      property_types: pick("property_types", PROPERTY_TYPES),
      rehab_levels: pick("rehab_levels", REHAB_LEVELS),
      strategies: pick("strategies", STRATEGIES),
      email_alerts: fd.get("email_alerts") === "on",
      ...(fd.get("sms_off") === "on" ? { sms_consent: false } : {}),
    })
    .eq("user_id", user.id);
  if (error) redirect("/portal/account?error=" + encodeURIComponent(error.message));
  revalidatePath("/portal/account");
  redirect("/portal/account?saved=1");
}

export async function uploadPof(fd: FormData) {
  const { supabase, user } = await requireRole("buyer");
  const file = fd.get("pof") as File | null;
  const err = checkUpload(file);
  if (err || !file || file.size === 0) redirect("/portal/account?error=" + encodeURIComponent(err ?? "Choose a file first"));
  // RLS check: the buyer must own a buyer record.
  const { data: row } = await supabase.from("cash_buyers").select("id").eq("user_id", user.id).single();
  if (!row) redirect("/portal/account?error=No+buyer+profile");
  const path = await uploadPrivate("proof-of-funds", user.id, file);
  await createAdminClient()
    .from("cash_buyers")
    .update({ pof_path: path, pof_uploaded_at: new Date().toISOString(), pof_verified: false })
    .eq("id", row.id);
  revalidatePath("/portal/account");
  redirect("/portal/account?saved=1");
}
