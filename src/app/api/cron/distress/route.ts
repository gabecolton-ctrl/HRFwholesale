import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pullFeed, type Feed } from "@/lib/socrata";
import { syncList, type LeadList } from "@/lib/distress";
import { scanMarket, type Market } from "@/lib/scanner";
import { getSettings } from "@/lib/settings";
import { sendScheduledAlerts } from "@/lib/alerts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Runs every morning (vercel.json): pulls new city code complaints and imports finished owner lists. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const ok = secret
    ? req.headers.get("authorization") === `Bearer ${secret}`
    : (req.headers.get("user-agent") ?? "").startsWith("vercel-cron");
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = createAdminClient();
  const out: Record<string, unknown> = {};

  const { data: feeds } = await db.from("signal_feeds").select("*").eq("active", true);
  for (const f of (feeds ?? []) as Feed[]) {
    try {
      out[f.name] = await pullFeed(db, f);
    } catch (e) {
      out[f.name] = { error: (e as Error).message };
    }
  }

  const { data: lists } = await db.from("lead_lists").select("*").in("status", ["processing", "completed"]);
  for (const l of (lists ?? []) as LeadList[]) {
    const after = await syncList(db, l);
    out[`list:${l.name}`] = after.status;
  }
  // Deal Scanner: each active city once a week (spread out: at most 3 cities per day).
  if (process.env.RENTCAST_API_KEY) {
    const weekAgo = new Date(Date.now() - 6.5 * 86_400_000).toISOString();
    const { data: due } = await db.from("scan_markets").select("*").eq("active", true)
      .or(`last_scanned_at.is.null,last_scanned_at.lt.${weekAgo}`).order("last_scanned_at", { ascending: true, nullsFirst: true }).limit(3);
    const settings = await getSettings(db);
    for (const m of (due ?? []) as Market[]) {
      try {
        out[`scan:${m.city}`] = await scanMarket(db, m, settings);
      } catch (e) {
        out[`scan:${m.city}`] = { error: (e as Error).message };
      }
    }
  }
  // Deal alerts: the rest of the buyers list after Tier A's head start, plus newly joined buyers.
  try {
    out.alerts = await sendScheduledAlerts();
  } catch (e) {
    out.alerts = { error: (e as Error).message };
  }
  return NextResponse.json({ ok: true, ...out });
}
