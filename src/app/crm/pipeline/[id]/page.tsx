import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { Notice, PageHeader, StatusPill } from "@/components/crm/ui";
import { DealForm } from "@/components/crm/DealForm";
import { ConfirmButton } from "@/components/ConfirmButton";
import { dealFormOptions } from "../options";
import { dateTime } from "@/lib/format";
import { deleteDeal } from "../actions";

export const metadata = { title: "Deal" };

export default async function DealPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { supabase, profile } = await requireRole("owner", "acquisitions", "dispositions");
  const { id } = await params;
  const sp = await searchParams;
  const { data: deal } = await supabase.from("deals").select("*").eq("id", id).maybeSingle();
  if (!deal) notFound();
  const opts = await dealFormOptions(supabase, profile.role);

  return (
    <>
      <div className="mb-3 text-sm"><Link href="/crm/pipeline" className="text-ink-soft underline">← Pipeline</Link></div>
      <PageHeader
        title={deal.address}
        sub={<>Updated {dateTime(deal.updated_at)} {deal.lead_id && profile.role !== "dispositions" ? <>· <Link href={`/crm/leads/${deal.lead_id}`} className="underline">Seller lead</Link></> : null}</>}
        actions={<StatusPill status={deal.status} />}
      />
      {sp.saved && <Notice>Saved.</Notice>}
      {sp.error && <Notice tone="danger">{sp.error}</Notice>}
      <DealForm deal={deal} role={profile.role} buyers={opts.buyers} reps={opts.reps} />
      {profile.role === "owner" && (
        <form action={deleteDeal} className="mt-6 text-right">
          <input type="hidden" name="id" value={id} />
          <ConfirmButton message="Delete this deal permanently? Consider marking it Cancelled instead.">Delete deal</ConfirmButton>
        </form>
      )}
    </>
  );
}
