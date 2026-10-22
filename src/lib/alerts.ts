import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailConfigured, esc } from "@/lib/email";
import { ASSIGNMENT_DISCLOSURE, site } from "@/lib/site";

export type Match = { buyer_id: string; name: string; email: string; tier: string; unsubscribe_token: string; already_alerted: boolean };

export function photoUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/deal-photos/${path.split("/").map(encodeURIComponent).join("/")}`;
}

const money = (n: unknown) =>
  n === null || n === undefined || n === "" ? "—" : Number(n).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** Buyers whose buy box matches the deal. Call only after checking the user may see the deal. */
export async function matchingBuyers(dealId: string): Promise<Match[]> {
  const { data, error } = await createAdminClient().rpc("matching_buyers", { p_deal_id: dealId });
  if (error) throw error;
  return (data ?? []) as Match[];
}

/**
 * Emails matching buyers who haven't been alerted about this deal yet.
 * scope "A" = Tier A only (the playbook's "best buyers first"), "rest" = everyone else.
 * Each buyer gets at most one alert per deal, ever.
 */
export async function sendDealAlerts(dealId: string, scope: "A" | "rest") {
  const db = createAdminClient();
  const { data: d } = await db
    .from("deals")
    .select("id,area,city,zip,property_type,beds,baths,sqft,list_price,assignment_price,arv,repair_estimate,rehab_level,closing_date,photo_paths,published_to_portal,status")
    .eq("id", dealId)
    .single();
  if (!d || !d.published_to_portal) return { sent: 0, failed: 0, skipped: 0, note: "Deal isn't published to the portal." };
  if (!["Under contract", "Marketing"].includes(d.status)) return { sent: 0, failed: 0, skipped: 0, note: "Deal isn't available anymore." };

  const all = await matchingBuyers(dealId);
  const targets = all.filter((m) => !m.already_alerted && (scope === "A" ? m.tier === "A" : m.tier !== "A"));
  if (targets.length === 0) return { sent: 0, failed: 0, skipped: 0, note: "No new matching buyers to email." };
  if (!emailConfigured()) return { sent: 0, failed: 0, skipped: targets.length, note: "Email sending isn't set up yet (Resend), so nothing was sent." };

  const where = [d.area, d.city].filter(Boolean).join(", ") || d.zip || "DFW";
  const specs = [d.beds && `${d.beds} bd`, d.baths && `${d.baths} ba`, d.sqft && `${Number(d.sqft).toLocaleString()} sqft`].filter(Boolean).join(" · ");
  const price = d.list_price ?? d.assignment_price;
  const subject = `New deal: ${specs ? specs.replace(/ · .*$/, "") + " in " : ""}${where} · ${money(price)}`;
  const link = `${site.url}/portal/deals/${d.id}`;
  const photo = d.photo_paths?.[0] ? photoUrl(d.photo_paths[0]) : null;

  const messages = targets.map((m) => {
    const unsub = `${site.url}/alerts/unsubscribe?t=${m.unsubscribe_token}`;
    const html = `<!doctype html><html><body style="margin:0;background:#f7f4ee;font-family:Arial,Helvetica,sans-serif;color:#13283d">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border:1px solid #e3ddd2;border-radius:12px" cellpadding="0" cellspacing="0">
${photo ? `<tr><td><img src="${esc(photo)}" alt="" width="560" style="display:block;width:100%;max-width:560px;height:auto;border-radius:12px 12px 0 0"></td></tr>` : ""}
<tr><td style="padding:24px">
<p style="margin:0 0 4px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">New off-market deal · ${esc(where)}</p>
<h1 style="margin:0 0 12px;font-size:26px">${esc(money(price))}</h1>
<p style="margin:0 0 16px;font-size:15px;color:#3c5168">${esc([d.property_type, specs].filter(Boolean).join(" · "))}</p>
<table role="presentation" width="100%" style="font-size:14px;margin-bottom:20px" cellpadding="6" cellspacing="0">
<tr><td style="color:#6b7280">ARV</td><td align="right"><b>${esc(money(d.arv))}</b></td></tr>
<tr><td style="color:#6b7280">Repair estimate</td><td align="right"><b>${esc(money(d.repair_estimate))}</b>${d.rehab_level ? ` (${esc(d.rehab_level)})` : ""}</td></tr>
<tr><td style="color:#6b7280">Closing by</td><td align="right"><b>${esc(d.closing_date ?? "—")}</b></td></tr>
</table>
<a href="${esc(link)}" style="display:inline-block;background:#b4502b;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:8px">View the deal</a>
<p style="margin:20px 0 0;font-size:12px;color:#6b7280;border-top:1px solid #e3ddd2;padding-top:12px">${esc(ASSIGNMENT_DISCLOSURE)}</p>
</td></tr></table>
<p style="max-width:560px;font-size:11px;color:#6b7280;line-height:1.5;margin:16px auto 0">
You're getting this because ${esc(m.name)} joined the H.R.F Assets LLC buyers list and this deal matches your buy box.
<a href="${esc(site.url)}/portal" style="color:#6b7280">Update your buy box</a> ·
<a href="${esc(unsub)}" style="color:#6b7280">Unsubscribe from deal alerts</a><br>${esc(site.mailingAddress)}</p>
</td></tr></table></body></html>`;
    const text = [
      `New off-market deal in ${where}: ${money(price)}`,
      [d.property_type, specs].filter(Boolean).join(" · "),
      `ARV ${money(d.arv)} · Repairs ${money(d.repair_estimate)} · Closing by ${d.closing_date ?? "—"}`,
      `View it: ${link}`,
      "",
      ASSIGNMENT_DISCLOSURE,
      "",
      `Unsubscribe from deal alerts: ${unsub}`,
      site.mailingAddress,
    ].join("\n");
    return {
      from: process.env.EMAIL_FROM,
      to: [m.email],
      reply_to: site.dealsEmail,
      subject,
      html,
      text,
      headers: {
        "List-Unsubscribe": `<${site.url}/api/unsubscribe?t=${m.unsubscribe_token}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    };
  });

  let sent = 0;
  let failed = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const who = targets.slice(i, i + 100);
    let ok = false;
    let err = "";
    try {
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(chunk),
      });
      ok = res.ok;
      if (!ok) err = ((await res.json().catch(() => ({}))) as { message?: string }).message ?? `HTTP ${res.status}`;
    } catch (e) {
      err = (e as Error).message;
    }
    await db.from("deal_alerts").upsert(
      who.map((m) => ({ deal_id: dealId, buyer_id: m.buyer_id, email: m.email, status: ok ? "sent" : "failed", error: ok ? null : err })),
      { onConflict: "deal_id,buyer_id" },
    );
    if (ok) sent += who.length;
    else failed += who.length;
  }
  return { sent, failed, skipped: 0, note: failed ? "Some emails failed. Check your Resend dashboard." : "" };
}
