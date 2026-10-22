import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { Notice, PageHeader } from "@/components/crm/ui";
import { getSettings } from "@/lib/settings";
import { Analyzer } from "./Analyzer";

export const metadata = { title: "Deal Analyzer" };

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export default async function AnalyzerPage({ searchParams }: { searchParams: Promise<{ lead?: string; error?: string }> }) {
  const { supabase } = await requireRole("owner", "acquisitions");
  const { lead: leadId, error } = await searchParams;
  const settings = await getSettings(supabase);
  const rates = {
    Turnkey: settings.rehab_turnkey_sqft,
    Light: settings.rehab_light_sqft,
    Medium: settings.rehab_medium_sqft,
    Heavy: settings.rehab_heavy_sqft,
  };

  let lead: { id: string; label: string } | undefined;
  let init = { pct: s(settings.default_mao_pct), fee: s(settings.default_fee) } as Record<string, unknown>;
  if (leadId) {
    const { data: l } = await supabase.from("leads").select("id,seller_name,address,est_arv,est_repairs,sqft,asking_price,offer_amount,analysis").eq("id", leadId).maybeSingle();
    if (l) {
      const a = (l.analysis ?? {}) as Record<string, unknown>;
      lead = { id: l.id, label: l.address };
      init = {
        arv: s(a.arv ?? l.est_arv),
        repairs: s(a.repairs ?? l.est_repairs),
        sqft: s(a.sqft ?? l.sqft),
        price: s(a.price ?? l.offer_amount ?? l.asking_price),
        pct: s(a.mao_pct ?? settings.default_mao_pct),
        fee: s(a.fee ?? settings.default_fee),
        rehab: s(a.rehab_level),
        comps: a.comps ?? [],
      };
    }
  }

  return (
    <>
      {lead && <p className="mb-3 text-sm"><Link href={`/crm/leads/${lead.id}`} className="text-ink-soft underline">← Back to lead</Link></p>}
      <PageHeader title="Deal Analyzer" sub={lead ? `Analyzing ${lead.label}` : "MAO = ARV × MAO% − repairs − your fee. Price at or under MAO is a GO."} />
      {error && <Notice tone="danger">{error}</Notice>}
      <Analyzer init={init as never} rates={rates} lead={lead} />
    </>
  );
}
