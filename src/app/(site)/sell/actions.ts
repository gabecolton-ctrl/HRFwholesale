"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SOURCE_COOKIE } from "@/lib/tracking";
import { HEARD_TO_SOURCE } from "@/lib/constants";
import { esc, sendEmail } from "@/lib/email";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { looksLikeBot, requestMeta } from "@/lib/request-meta";
import { SELLER_CONSENT_TEXT, SELLER_CONSENT_VERSION } from "@/lib/site";
import { phoneDigits, phonePretty } from "@/lib/format";
import { STATE_CODES } from "@/lib/constants";
import { notifyTeam } from "@/lib/email";
import { emailLinkBase, site } from "@/lib/site";

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
  state: z.string().trim().refine((s) => STATE_CODES.includes(s), "Please choose the state the property is in"),
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
    ["name", "phone", "email", "address", "city", "state", "zip", "condition", "timeline", "reason", "heard"].map((k) => [k, String(fd.get(k) ?? "")]),
  );
  if (looksLikeBot(fd)) redirect("/sell/thanks"); // silently drop bots

  const parsed = schema.safeParse({ ...raw, consent: fd.get("consent") ?? undefined });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form", fields: raw };
  }
  const v = parsed.data;
  // Lead source: tracking link/ad tag first, then the seller's own answer, else "Website".
  const tagged = (await cookies()).get(SOURCE_COOKIE)?.value?.slice(0, 60);
  const heard = String(fd.get("heard") ?? "");
  const leadSource = tagged || HEARD_TO_SOURCE[heard] || "Website";
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
      state: v.state,
      zip: v.zip || null,
      condition: v.condition || null,
      timeline: v.timeline || null,
      reason_for_selling: v.reason || null,
      lead_source: leadSource,
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

  // Speed to lead: tell the team right away (no-op until email is set up).
  await notifyTeam(
    `New seller lead: ${v.address}`,
    [
      `Source: ${leadSource}`,
      `${v.name} · ${phonePretty(v.phone)}${v.email ? ` · ${v.email}` : ""}`,
      `${v.address}${v.city ? `, ${v.city}` : ""}, ${v.state} ${v.zip}`,
      [v.condition, v.timeline].filter(Boolean).join(" · "),
      v.reason ? `Reason: ${v.reason}` : "",
    ].filter(Boolean),
    `${emailLinkBase()}/crm/leads/${lead.id}`,
  );

  await db.from("lead_activities").insert({
    lead_id: lead.id,
    kind: "system",
    outcome: `Submitted the website form${tagged ? ` (tracked: ${tagged})` : ""}${heard ? ` · said they heard about us via: ${heard}` : ""}`,
  });

  // Instant reply to the seller (only if they gave an email).
  if (v.email) {
    const first = v.name.split(" ")[0];
    await sendEmail({
      to: v.email,
      replyTo: site.email,
      subject: `We got your request, ${first}`,
      text: [
        `Hi ${first},`,
        "",
        `Thanks for reaching out to ${site.legalName} about ${v.address}. We received your request and will call you shortly at ${phonePretty(v.phone)} to learn a little more and set up a quick walkthrough.`,
        "",
        "There's no cost and no obligation. If you'd rather talk now, call us at " + site.phone + ` (${site.hours}).`,
        "",
        site.legalName,
        site.email,
      ].join("\n"),
      html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#13283d;max-width:540px">
<p>Hi ${esc(first)},</p>
<p>Thanks for reaching out to <b>${esc(site.legalName)}</b> about <b>${esc(v.address)}</b>. We received your request and will call you shortly at ${esc(phonePretty(v.phone))} to learn a little more and set up a quick walkthrough.</p>
<p>There's no cost and no obligation. If you'd rather talk now, call us at <a href="${esc(site.phoneHref)}">${esc(site.phone)}</a> (${esc(site.hours)}).</p>
<p style="margin-top:24px">${esc(site.legalName)}<br><a href="mailto:${esc(site.email)}">${esc(site.email)}</a></p></div>`,
    }).catch(() => undefined);
  }

  redirect("/sell/thanks");
}
