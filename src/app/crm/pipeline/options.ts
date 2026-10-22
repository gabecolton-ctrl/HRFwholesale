import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppRole } from "@/lib/constants";

export async function dealFormOptions(supabase: SupabaseClient, role: AppRole) {
  const canBuyers = role === "owner" || role === "dispositions";
  const [buyers, staff] = await Promise.all([
    canBuyers
      ? supabase.from("cash_buyers").select("id,name,company,tier").eq("status", "Active").order("tier").order("name").limit(1000)
      : Promise.resolve({ data: [] as { id: string; name: string; company: string | null; tier: string }[] }),
    role === "owner"
      ? supabase.from("profiles").select("id,full_name,email,role").in("role", ["owner", "acquisitions", "dispositions"]).eq("active", true)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string | null; role: string }[] }),
  ]);
  const label = (p: { full_name: string | null; email: string | null }) => p.full_name ?? p.email ?? "Team member";
  return {
    buyers: (buyers.data ?? []).map((b) => ({ id: b.id, label: `${b.name}${b.company ? ` (${b.company})` : ""} · ${b.tier}` })),
    reps: {
      acq: (staff.data ?? []).filter((p) => p.role !== "dispositions").map((p) => ({ id: p.id, label: label(p) })),
      dispo: (staff.data ?? []).filter((p) => p.role !== "acquisitions").map((p) => ({ id: p.id, label: label(p) })),
    },
  };
}
