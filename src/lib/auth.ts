import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/constants";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: AppRole;
  active: boolean;
};

export const getSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null as Profile | null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("id,email,full_name,role,active")
    .eq("id", user.id)
    .single<Profile>();
  return { supabase, user, profile: profile && profile.active ? profile : null };
});

/** Use at the top of every CRM page/action. Redirects anyone without one of the roles. */
export async function requireRole(...roles: AppRole[]) {
  const s = await getSession();
  if (!s.user) redirect("/login");
  if (!s.profile || !roles.includes(s.profile.role)) {
    if (s.profile?.role === "buyer") redirect("/portal");
    redirect("/no-access");
  }
  return { supabase: s.supabase, user: s.user, profile: s.profile };
}
