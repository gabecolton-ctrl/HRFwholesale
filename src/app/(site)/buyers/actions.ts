"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { looksLikeBot, requestMeta } from "@/lib/request-meta";
import { BUYER_CONSENT_TEXT, BUYER_CONSENT_VERSION, site } from "@/lib/site";
import { phoneDigits, toList, toNumber } from "@/lib/format";
import { checkUpload, uploadPrivate } from "@/lib/files";
import { PROPERTY_TYPES, REHAB_LEVELS, STRATEGIES } from "@/lib/constants";

export type BuyerFormState = { error?: string; fields?: Record<string, string> };

const schema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(120),
  company: z.string().trim().max(120),
  phone: z.string().trim().transform(phoneDigits).refine((d) => d.length === 10, "Please enter a 10-digit phone number"),
  email: z.email("Please enter a valid email"),
  password: z.string().min(10, "Password must be at least 10 characters"),
  areas: z.string().trim().min(2, "Tell us which ZIP codes or areas you buy in").max(1000),
});

export async function signUpBuyer(_prev: BuyerFormState, fd: FormData): Promise<BuyerFormState> {
  const keep = ["name", "company", "phone", "email", "areas", "price_min", "price_max"];
  const raw = Object.fromEntries(keep.map((k) => [k, String(fd.get(k) ?? "")]));
  if (looksLikeBot(fd)) redirect("/buyers/thanks");

  const parsed = schema.safeParse({ ...raw, password: String(fd.get("password") ?? "") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, fields: raw };
  const v = parsed.data;

  const priceMin = toNumber(fd.get("price_min"));
  const priceMax = toNumber(fd.get("price_max"));
  if (priceMin !== null && priceMax !== null && priceMin > priceMax) {
    return { error: "Minimum price is higher than maximum price", fields: raw };
  }
  const pick = (name: string, allowed: readonly string[]) =>
    fd.getAll(name).map(String).filter((x) => allowed.includes(x));
  const propertyTypes = pick("property_types", PROPERTY_TYPES);
  const rehab = pick("rehab_levels", REHAB_LEVELS);
  const strategies = pick("strategies", STRATEGIES);
  if (rehab.length === 0) return { error: "Pick at least one rehab level you'll take on", fields: raw };

  const pof = fd.get("pof") as File | null;
  const fileErr = checkUpload(pof);
  if (fileErr) return { error: fileErr, fields: raw };

  // 1) Create the login (Supabase emails a confirmation link).
  const supabase = await createClient();
  const { data: signUp, error: suErr } = await supabase.auth.signUp({
    email: v.email,
    password: v.password,
    options: {
      data: { full_name: v.name },
      emailRedirectTo: `${site.url}/auth/accept?next=/portal`,
    },
  });
  if (suErr) {
    return { error: suErr.message.includes("Password") ? suErr.message : "We couldn't create your account. Please try again.", fields: raw };
  }
  const user = signUp.user;
  if (!user || (user.identities && user.identities.length === 0)) {
    return { error: "An account with this email already exists. Sign in instead, or reset your password.", fields: raw };
  }

  const db = createAdminClient();
  await db.from("profiles").update({ role: "buyer", full_name: v.name }).eq("id", user.id);

  // 2) Proof of funds (optional now, can be added later in the portal).
  let pofPath: string | null = null;
  if (pof && pof.size > 0) {
    try {
      pofPath = await uploadPrivate("proof-of-funds", user.id, pof);
    } catch (e) {
      console.error("POF upload failed", e);
    }
  }

  // 3) Buyer record. If dispositions already entered this buyer, link to it.
  const row = {
    user_id: user.id,
    name: v.name,
    company: v.company || null,
    phone: v.phone,
    email: v.email.toLowerCase(),
    areas: toList(v.areas),
    price_min: priceMin,
    price_max: priceMax,
    property_types: propertyTypes,
    rehab_levels: rehab,
    strategies,
    sms_consent: fd.get("sms_consent") === "on",
    source: "Website sign-up",
    ...(pofPath ? { pof_path: pofPath, pof_uploaded_at: new Date().toISOString() } : {}),
  };

  const { data: existing } = await db
    .from("cash_buyers")
    .select("id")
    .is("user_id", null)
    .ilike("email", v.email)
    .limit(1)
    .maybeSingle();

  const { data: buyer, error: bErr } = existing
    ? await db.from("cash_buyers").update({ ...row, source: undefined }).eq("id", existing.id).select("id").single()
    : await db.from("cash_buyers").insert(row).select("id").single();

  if (bErr || !buyer) {
    console.error("buyer insert failed", bErr);
    return { error: "Your account was created, but we couldn't save your buy box. Sign in to finish, or call us.", fields: raw };
  }

  if (row.sms_consent) {
    const meta = await requestMeta();
    const { error: cErr } = await db.from("consent_records").insert({
      buyer_id: buyer.id,
      kind: "buyer_alerts",
      consent_text: `[v${BUYER_CONSENT_VERSION}] ${BUYER_CONSENT_TEXT}`,
      phone: v.phone,
      email: v.email,
      ip_address: meta.ip,
      user_agent: meta.userAgent,
      page_url: meta.referer,
    });
    // No consent record = no texting. Fall back to email-only.
    if (cErr) await db.from("cash_buyers").update({ sms_consent: false }).eq("id", buyer.id);
  }

  await supabase.auth.signOut(); // they confirm their email first
  redirect("/buyers/thanks");
}
