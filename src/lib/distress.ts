import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listRows, listStatus, rowToPropertyData } from "@/lib/tracerfy";

export type LeadList = {
  id: string;
  created_at: string;
  name: string;
  strategy: string;
  geography: Record<string, unknown>;
  filters: Record<string, unknown>;
  requested_count: number;
  tracerfy_id: string | null;
  status: "pending" | "processing" | "completed" | "imported" | "failed";
  credits: number;
  rows_imported: number;
  error: string | null;
};

function signalType(r: Record<string, unknown>, fallback: string) {
  const yes = (k: string) => r[k] === true || /^(true|yes|1)$/i.test(String(r[k] ?? ""));
  if (yes("pre_foreclosure")) return "Pre-foreclosure";
  if (yes("vacant")) return "Vacant";
  if (yes("free_clear")) return "Free & clear";
  if (yes("high_equity") && yes("absentee_owner")) return "High-equity absentee";
  if (yes("absentee_owner")) return "Absentee owner";
  return fallback;
}

/** Checks a list build at Tracerfy; once it's done, copies every row into the inbox. */
export async function syncList(db: SupabaseClient, list: LeadList): Promise<LeadList> {
  if (!list.tracerfy_id || !["processing", "completed"].includes(list.status)) return list;
  try {
    const st = await listStatus(list.tracerfy_id);
    if (st.failed) {
      await db.from("lead_lists").update({ status: "failed", error: st.error || "Tracerfy couldn't build this list." }).eq("id", list.id);
      return { ...list, status: "failed", error: st.error };
    }
    if (!st.done) return list;

    let imported = 0;
    for (let page = 1; page <= 60; page++) {
      const { ready, rows, totalPages } = await listRows(list.tracerfy_id, page);
      if (!ready) return list;
      const signals = rows
        .map((r) => {
          const address = String(r.address ?? "").trim();
          if (!address) return null;
          const zip = String(r.zip_code ?? r.zip ?? "").replace(/\D/g, "").slice(0, 5) || null;
          return {
            source: "list",
            list_id: list.id,
            source_id: `${address.toLowerCase()}|${zip ?? ""}`,
            signal_type: signalType(r, list.name),
            address,
            city: String(r.city ?? "") || null,
            state: String(r.state ?? "") || null,
            zip,
            reported_at: null,
            property_data: rowToPropertyData(r),
          };
        })
        .filter(Boolean) as Record<string, unknown>[];
      if (signals.length) {
        const { data, error } = await db.from("distress_signals").upsert(signals, { onConflict: "list_id,source_id", ignoreDuplicates: true }).select("id");
        if (error) throw new Error(error.message);
        imported += data?.length ?? 0;
      }
      if (page >= totalPages) break;
    }
    const patch = { status: "imported" as const, credits: st.credits, rows_imported: list.rows_imported + imported, error: null };
    await db.from("lead_lists").update(patch).eq("id", list.id);
    return { ...list, ...patch };
  } catch (e) {
    const error = (e as Error).message;
    await db.from("lead_lists").update({ error }).eq("id", list.id);
    return { ...list, error };
  }
}
