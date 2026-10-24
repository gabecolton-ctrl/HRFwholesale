"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailLinkBase, site } from "@/lib/site";
import { esc, sendEmail } from "@/lib/email";
import { ROLE_LABELS, type AppRole } from "@/lib/constants";

const ROLES = ["pending", "owner", "acquisitions", "dispositions", "va"];

export type InviteState = { error?: string; link?: string; email?: string; emailed?: boolean; existing?: boolean; note?: string };

/**
 * Creates a one-time setup link WITHOUT relying on Supabase to send email
 * (no Supabase rate limit, no template setup). The link is emailed through
 * Resend and also shown to the owner to copy and text if needed.
 */
export async function inviteMember(_prev: InviteState, fd: FormData): Promise<InviteState> {
  const { user } = await requireRole("owner");
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const role = String(fd.get("role") ?? "va");
  const name = String(fd.get("full_name") ?? "").trim();
  if (!email || !ROLES.includes(role) || role === "pending") return { error: "Enter an email and pick a role." };
  if (email === (user.email ?? "").toLowerCase()) return { error: "That's your own login." };

  const admin = createAdminClient();
  let type: "invite" | "recovery" = "invite";
  let res = await admin.auth.admin.generateLink({ type: "invite", email, options: { data: { full_name: name } } });
  // Already has a login (e.g. from an earlier invite): send a set-password link instead.
  if (res.error && /already|registered|exists/i.test(res.error.message)) {
    type = "recovery";
    res = await admin.auth.admin.generateLink({ type: "recovery", email });
  }
  if (res.error || !res.data?.user || !res.data.properties?.hashed_token) {
    return { error: res.error?.message ?? "Couldn't create the invite." };
  }

  const userId = res.data.user.id;
  const { data: prof } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (prof?.role === "owner" && role !== "owner") return { error: "That person is an owner. Change their role below instead." };
  await admin.from("profiles").upsert({ id: userId, email, role, full_name: name || null, active: true }, { onConflict: "id" });

  const link = `${emailLinkBase()}/auth/join?token_hash=${encodeURIComponent(res.data.properties.hashed_token)}&type=${type}`;
  const first = name.split(" ")[0] || "there";
  const roleLabel = ROLE_LABELS[role as AppRole] ?? role;
  const sent = await sendEmail({
    to: email,
    subject: `You're invited to the H.R.F Assets LLC CRM`,
    text: `Hi ${first},\n\nYou've been added to the H.R.F Assets LLC CRM as ${roleLabel}.\n\nSet your password here (the link works once):\n${link}\n\nThen sign in any time at ${emailLinkBase()}/login\n`,
    html: `<div style="font-family:Arial,sans-serif;font-size:15px;color:#13283d;max-width:520px">
<p>Hi ${esc(first)},</p>
<p>You've been added to the <b>H.R.F Assets LLC</b> CRM as <b>${esc(roleLabel)}</b>.</p>
<p><a href="${esc(link)}" style="display:inline-block;background:#b4502b;color:#fff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:8px">Set up your account</a></p>
<p style="font-size:13px;color:#6b7280">The button works once. After that, sign in at <a href="${esc(emailLinkBase())}/login">${esc(emailLinkBase().replace(/^https?:\/\//, ""))}/login</a>.</p></div>`,
  });

  revalidatePath("/crm/team");
  return {
    link,
    email,
    emailed: sent.ok,
    existing: type === "recovery",
    note: sent.ok ? undefined : "skipped" in sent && sent.skipped ? "Email sending isn't set up, so copy the link below." : `Email didn't send (${sent.error}). Copy the link below.`,
  };
}

export async function setRole(fd: FormData) {
  const { supabase } = await requireRole("owner");
  const id = String(fd.get("id"));
  const role = String(fd.get("role"));
  const active = fd.get("active") === "on";
  if (!ROLES.includes(role)) redirect("/crm/team?error=Bad+role");
  const { error } = await supabase.from("profiles").update({ role, active }).eq("id", id);
  if (error) redirect(`/crm/team?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/crm/team");
  redirect("/crm/team?saved=1");
}

/** Permanently removes a team member's login. Their leads, notes and deals stay (unassigned). */
export async function deleteMember(fd: FormData) {
  const { user } = await requireRole("owner");
  const id = String(fd.get("id"));
  if (id === user.id) redirect("/crm/team?error=You+can't+delete+your+own+login");
  const admin = createAdminClient();
  const { data: p } = await admin.from("profiles").select("role,email").eq("id", id).maybeSingle();
  if (p?.role === "owner") {
    const { count } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "owner").eq("active", true);
    if ((count ?? 0) <= 1) redirect("/crm/team?error=Can't+delete+the+last+owner");
  }
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) redirect(`/crm/team?error=${encodeURIComponent(`Couldn't delete ${p?.email ?? "user"}: ${error.message}`)}`);
  revalidatePath("/crm/team");
  redirect("/crm/team?deleted=1");
}
