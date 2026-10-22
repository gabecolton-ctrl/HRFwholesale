"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { site } from "@/lib/site";

const ROLES = ["pending", "owner", "acquisitions", "dispositions", "va"];

export async function inviteMember(fd: FormData) {
  await requireRole("owner");
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const role = String(fd.get("role") ?? "va");
  const name = String(fd.get("full_name") ?? "").trim();
  if (!email || !ROLES.includes(role) || role === "pending") redirect("/crm/team?error=Enter+an+email+and+role");
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: name },
    redirectTo: `${site.url}/auth/confirm?next=/reset-password`,
  });
  if (error || !data.user) redirect(`/crm/team?error=${encodeURIComponent(error?.message ?? "Invite failed")}`);
  await admin.from("profiles").update({ role, full_name: name || null }).eq("id", data.user.id);
  revalidatePath("/crm/team");
  redirect("/crm/team?invited=1");
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
