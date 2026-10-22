import Papa from "papaparse";
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";

const TABLES: Record<string, { table: string; order: string }> = {
  leads: { table: "leads", order: "created_at" },
  "lead-activities": { table: "lead_activities", order: "created_at" },
  buyers: { table: "cash_buyers", order: "created_at" },
  deals: { table: "deals", order: "created_at" },
  "consent-records": { table: "consent_records", order: "created_at" },
  team: { table: "profiles", order: "created_at" },
  "buyer-offers": { table: "deal_offers", order: "created_at" },
  "buyer-acknowledgments": { table: "deal_acknowledgments", order: "created_at" },
  "deal-alerts": { table: "deal_alerts", order: "created_at" },
  "monthly-targets": { table: "monthly_targets", order: "month" },
  "marketing-spend": { table: "marketing_spend", order: "month" },
};

// Owner-only full CSV export of any table. Reads in pages of 1,000 rows.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ table: string }> }) {
  const { table } = await params;
  const { supabase, profile } = await getSession();
  if (profile?.role !== "owner") return new NextResponse("Owner only", { status: 403 });
  const cfg = TABLES[table];
  if (!cfg) return new NextResponse("Unknown table", { status: 404 });

  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(cfg.table).select("*").order(cfg.order).range(from, from + 999);
    if (error) return new NextResponse(error.message, { status: 500 });
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  // Arrays (areas, rehab levels…) become "a; b; c" so they open cleanly in Excel.
  const flat = rows.map((r) =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Array.isArray(v) ? v.join("; ") : v])),
  );
  const csv = "﻿" + Papa.unparse(flat);
  const stamp = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hrf-${table}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
