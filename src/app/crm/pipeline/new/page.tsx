import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/crm/ui";
import { DealForm } from "@/components/crm/DealForm";
import { dealFormOptions } from "../options";
import { todayCentral } from "@/lib/format";

export const metadata = { title: "New deal" };

function addDays(d: string, n: number) {
  return new Date(new Date(d + "T12:00:00").getTime() + n * 86_400_000).toISOString().slice(0, 10);
}

export default async function NewDeal({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  const { supabase, profile } = await requireRole("owner", "acquisitions", "dispositions");
  const { lead: leadId } = await searchParams;
  const opts = await dealFormOptions(supabase, profile.role);
  const today = todayCentral();

  let prefill: Record<string, unknown> = { contract_signed_date: today, option_period_end: addDays(today, 10), closing_date: addDays(today, 30) };
  if (leadId && profile.role !== "dispositions") {
    const { data: l } = await supabase.from("leads").select("*").eq("id", leadId).maybeSingle();
    if (l) {
      prefill = {
        ...prefill,
        lead_id: l.id, address: l.address, city: l.city, state: l.state, zip: l.zip, property_type: l.property_type,
        beds: l.beds, baths: l.baths, sqft: l.sqft, year_built: l.year_built,
        arv: l.est_arv, repair_estimate: l.est_repairs, contract_price: l.offer_amount,
      };
    }
  }

  return (
    <>
      <PageHeader title="New deal" sub="Seller signed? Log the contract here. Open title the same day." actions={<Link href="/crm/pipeline" className="btn btn-ghost btn-sm">Cancel</Link>} />
      <DealForm deal={prefill} role={profile.role} buyers={opts.buyers} reps={opts.reps} />
    </>
  );
}
