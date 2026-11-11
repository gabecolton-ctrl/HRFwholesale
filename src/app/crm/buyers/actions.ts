"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { POF_DECLINE_REASONS, PROPERTY_TYPES, REHAB_LEVELS, STRATEGIES } from "@/lib/constants";
import { phoneDigits, toList, toNumber, toText } from "@/lib/format";
import { checkUpload, uploadPrivate } from "@/lib/files";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailConfigured, esc, sendEmail } from "@/lib/email";
import { emailLinkBase, site } from "@/lib/site";

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


/** Declines the buyer's proof of funds and emails them to resubmit. */
export async function declinePof(fd: FormData) {
  const { supabase } = await requireRole("owner", "dispositions");
  const id = String(fd.get("id") ?? "");
  const reason = toText(fd.get("pof_decline_reason")) ?? POF_DECLINE_REASONS[0];
  const note = toText(fd.get("pof_decline_note"));
  const fullReason = reason === "Other" ? note ?? "Other" : note ? `${reason}. ${note}` : reason;
  const { data: b } = await supabase.from("cash_buyers").select("id,name,email,user_id,pof_path").eq("id", id).maybeSingle();
  if (!b) redirect("/crm/buyers?error=Buyer+not+found");
  if (!b.pof_path) redirect(`/crm/buyers/${id}?error=${encodeURIComponent("There's no proof of funds to decline.")}`);

  const { error } = await supabase
    .from("cash_buyers")
    .update({ pof_verified: false, pof_declined_at: new Date().toISOString(), pof_decline_reason: fullReason.slice(0, 500) })
    .eq("id", id);
  if (error) redirect(`/crm/buyers/${id}?error=${encodeURIComponent(error.message)}`);

  let mailed = "0";
  if (b.email && emailConfigured()) {
    const first = String(b.name ?? "").split(" ")[0] || "there";
    const link = `${emailLinkBase()}/portal/account`;
    const how = b.user_id
      ? `Please upload a new one here: ${link}`
      : `Please reply to this email with an updated proof of funds.`;
    const text = [
      `Hi ${first},`,
      "",
      "Thanks for sending your proof of funds. Unfortunately we can't accept the one we received.",
      "",
      `Reason: ${fullReason}`,
      "",
      "We need a recent statement (from the last 30 days) from a bank, lender or brokerage, showing your name or company name and available funds.",
      how,
      "",
      "Once we verify it, you'll get first access to our deals that match your buy box.",
      "",
      `${site.brand}`,
      site.phone,
    ].join("\n");
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#13283d;max-width:560px">
<p>Hi ${esc(first)},</p>
<p>Thanks for sending your proof of funds. Unfortunately we can't accept the one we received.</p>
<p style="background:#fbebeb;border-radius:8px;padding:10px 12px"><b>Reason:</b> ${esc(fullReason)}</p>
<p>We need a <b>recent statement (from the last 30 days)</b> from a bank, lender or brokerage, showing your name or company name and available funds.</p>
${b.user_id
  ? `<p><a href="${esc(link)}" style="display:inline-block;background:#b4502b;color:#fff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:8px">Upload a new proof of funds</a></p>`
  : `<p>Please <b>reply to this email</b> with an updated proof of funds.</p>`}
<p>Once we verify it, you'll get first access to our deals that match your buy box.</p>
<p style="color:#6b7280;font-size:13px">${esc(site.brand)} · ${esc(site.phone)}<br>${esc(site.mailingAddress)}</p></div>`;
    const r = await sendEmail({ to: b.email, subject: "We couldn't accept your proof of funds, please resubmit", html, text, replyTo: site.dealsEmail });
    mailed = r.ok ? "1" : "failed";
  }
  revalidatePath(`/crm/buyers/${id}`);
  revalidatePath("/crm/buyers");
  redirect(`/crm/buyers/${id}?pof_declined=${mailed}`);
}

/** One-click approve. */
export async function approvePof(fd: FormData) {
  const { supabase } = await requireRole("owner", "dispositions");
  const id = String(fd.get("id") ?? "");
  const amount = toNumber(fd.get("pof_amount"));
  await supabase.from("cash_buyers").update({ pof_verified: true, pof_declined_at: null, pof_decline_reason: null, ...(amount ? { pof_amount: amount } : {}) }).eq("id", id);
  revalidatePath(`/crm/buyers/${id}`);
  revalidatePath("/crm/buyers");
  redirect(`/crm/buyers/${id}?pof_approved=1`);
}
