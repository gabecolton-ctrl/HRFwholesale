import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pullFeed, type Feed } from "@/lib/socrata";
import { syncList, type LeadList } from "@/lib/distress";

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
  return NextResponse.json({ ok: true, ...out });
}
