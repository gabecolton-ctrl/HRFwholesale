import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Team members who can own leads (acquisitions reps and the owner). */
export async function leadOwners(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("profiles")
    .select("id,full_name,email,role")
    .in("role", ["owner", "acquisitions", "va"])
    .eq("active", true)
    .order("full_name");
  return data ?? [];
}
