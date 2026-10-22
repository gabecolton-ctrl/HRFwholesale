import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { Notice, PageHeader, StatusPill } from "@/components/crm/ui";
import { DealForm } from "@/components/crm/DealForm";
import { ConfirmButton } from "@/components/ConfirmButton";
import { dealFormOptions } from "../options";
import { dateTime } from "@/lib/format";
import { deleteDeal } from "../actions";
import { DealPhotos } from "@/components/crm/DealPhotos";
import { AlertsPanel, OffersPanel } from "@/components/crm/DealListingPanels";

export const metadata = { title: "Deal" };

export default async function DealPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string; alerted?: string; alertnote?: string }> }) {
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
      {sp.alerted && <Notice>Deal alert emailed to {sp.alerted} matching buyer{sp.alerted === "1" ? "" : "s"}.</Notice>}
      {sp.alertnote && <Notice tone="amber">Alerts: {sp.alertnote}</Notice>}
      <div className="space-y-5">
        <DealForm deal={deal} role={profile.role} buyers={opts.buyers} reps={opts.reps} />
        <DealPhotos dealId={id} paths={deal.photo_paths ?? []} publicBase={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/deal-photos`} />
        <OffersPanel supabase={supabase} dealId={id} role={profile.role} />
        {(profile.role === "owner" || profile.role === "dispositions") && (
          <AlertsPanel supabase={supabase} dealId={id} published={deal.published_to_portal} available={["Under contract", "Marketing"].includes(deal.status)} />
        )}
      </div>
      {profile.role === "owner" && (
        <form action={deleteDeal} className="mt-6 text-right">
          <input type="hidden" name="id" value={id} />
          <ConfirmButton message="Delete this deal permanently? Consider marking it Cancelled instead.">Delete deal</ConfirmButton>
        </form>
      )}
    </>
  );
}
