"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { looksLikeBot, requestMeta } from "@/lib/request-meta";
import { SELLER_CONSENT_TEXT, SELLER_CONSENT_VERSION } from "@/lib/site";
import { phoneDigits } from "@/lib/format";

export type FormState = { error?: string; fields?: Record<string, string> };

const schema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(120),
  phone: z
    .string()
    .trim()
    .transform(phoneDigits)
    .refine((d) => d.length === 10, "Please enter a 10-digit phone number"),
  email: z.union([z.literal(""), z.email("Please check your email address")]),
  address: z.string().trim().min(5, "Please enter the property address").max(200),
  city: z.string().trim().max(80).optional().default(""),
  zip: z
    .string()
    .trim()
    .regex(/^\d{5}$|^$/, "ZIP should be 5 digits")
    .optional()
    .default(""),
  condition: z.string().trim().max(80).optional().default(""),
  timeline: z.string().trim().max(80).optional().default(""),
  reason: z.string().trim().max(1000).optional().default(""),
  consent: z.literal("on", { error: "Please check the consent box so we can contact you about your offer" }),
});

export async function submitSellerLead(_prev: FormState, fd: FormData): Promise<FormState> {
  const raw = Object.fromEntries(
    ["name", "phone", "email", "address", "city", "zip", "condition", "timeline", "reason"].map((k) => [k, String(fd.get(k) ?? "")]),
  );
  if (looksLikeBot(fd)) redirect("/sell/thanks"); // silently drop bots

  const parsed = schema.safeParse({ ...raw, consent: fd.get("consent") ?? undefined });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form", fields: raw };
  }
  const v = parsed.data;
  const meta = await requestMeta();
  const db = createAdminClient();

  const { data: lead, error } = await db
    .from("leads")
    .insert({
      seller_name: v.name,
      phone: v.phone,
      email: v.email || null,
      address: v.address,
      city: v.city || null,
      zip: v.zip || null,
      condition: v.condition || null,
      timeline: v.timeline || null,
      reason_for_selling: v.reason || null,
      lead_source: "Website",
      next_follow_up: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date()), // call web leads today
    })
    .select("id")
    .single();

  if (error || !lead) {
    console.error("seller lead insert failed", error);
    return { error: "Something went wrong saving your request. Please call us instead.", fields: raw };
  }

  const { error: cErr } = await db.from("consent_records").insert({
    lead_id: lead.id,
    kind: "seller_tcpa",
    consent_text: `[v${SELLER_CONSENT_VERSION}] ${SELLER_CONSENT_TEXT}`,
    phone: v.phone,
    email: v.email || null,
    ip_address: meta.ip,
    user_agent: meta.userAgent,
    page_url: meta.referer,
  });
  if (cErr) {
    // No proof of consent = no lead. Roll back so we never call without a record.
    console.error("consent record insert failed", cErr);
    await db.from("leads").delete().eq("id", lead.id);
    return { error: "Something went wrong saving your request. Please call us instead.", fields: raw };
  }

  redirect("/sell/thanks");
}
