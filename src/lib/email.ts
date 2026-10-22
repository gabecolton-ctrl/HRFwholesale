import "server-only";

// Sends email through Resend (resend.com). If RESEND_API_KEY isn't set,
// nothing is sent and the caller is told, so the site keeps working.
//   RESEND_API_KEY      re_...
//   EMAIL_FROM          H.R.F Assets LLC <notifications@hrfassets.com>
//   NOTIFY_EMAIL        where new-lead / new-offer notices go (comma-separated ok)

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export type SendResult = { ok: true; id?: string } | { ok: false; error: string; skipped?: boolean };

export async function sendEmail(msg: {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  headers?: Record<string, string>;
}): Promise<SendResult> {
  if (!emailConfigured()) return { ok: false, error: "Email sending is not set up yet", skipped: true };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: Array.isArray(msg.to) ? msg.to : [msg.to],
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        reply_to: msg.replyTo,
        headers: msg.headers,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) return { ok: false, error: body.message ?? `Email failed (${res.status})` };
    return { ok: true, id: body.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Notice to the owner/team (new web lead, new buyer offer). Never throws. */
export async function notifyTeam(subject: string, lines: string[], link?: string) {
  const to = (process.env.NOTIFY_EMAIL ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (to.length === 0) return;
  const text = [...lines, link ? `\nOpen: ${link}` : ""].join("\n");
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#13283d">${lines
    .map((l) => `<p style="margin:0 0 8px">${esc(l)}</p>`)
    .join("")}${link ? `<p><a href="${esc(link)}" style="color:#b4502b;font-weight:bold">Open in CRM →</a></p>` : ""}</div>`;
  const r = await sendEmail({ to, subject, html, text });
  if (!r.ok && !("skipped" in r && r.skipped)) console.error("team notice failed", r.error);
}

export function esc(s: unknown) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
