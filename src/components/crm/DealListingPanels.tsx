import type { SupabaseClient } from "@supabase/supabase-js";
import { matchingBuyers } from "@/lib/alerts";
import { emailConfigured } from "@/lib/email";
import { sendAlertsAction, setOfferStatus } from "@/app/crm/pipeline/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { Flag } from "@/components/crm/ui";
import { dateShort, dateTime, money } from "@/lib/format";
import type { AppRole } from "@/lib/constants";

export async function OffersPanel({ supabase, dealId, role }: { supabase: SupabaseClient; dealId: string; role: AppRole }) {
  const { data: offers } = await supabase
    .from("deal_offers")
    .select("id,created_at,kind,amount,close_by,message,status,buyer:cash_buyers(id,name,company,phone,email,pof_verified,tier)")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false });
  const { count: acks } = await supabase.from("deal_acknowledgments").select("id", { count: "exact", head: true }).eq("deal_id", dealId);
  const canManage = role === "owner" || role === "dispositions";

  return (
    <section id="offers" className="card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold tracking-wide text-ink-soft uppercase">Buyer interest & offers ({offers?.length ?? 0})</h2>
        <span className="text-xs text-ink-soft">{acks ?? 0} buyer{acks === 1 ? "" : "s"} acknowledged the disclosure and viewed the address</span>
      </div>
      {(offers ?? []).length === 0 ? (
        <p className="text-sm text-ink-soft">No buyer interest yet. Publish the deal to the portal and send alerts.</p>
      ) : (
        <ul className="space-y-3">
          {(offers ?? []).map((o) => {
            const b = Array.isArray(o.buyer) ? o.buyer[0] : o.buyer;
            return (
              <li key={o.id} className="rounded-lg border border-line p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {o.kind === "offer" ? `Offer ${money(o.amount)}` : "Interested"}
                      {o.close_by && <span className="font-normal text-ink-soft"> · close by {dateShort(o.close_by)}</span>}
                    </p>
                    <p className="text-ink-soft">
                      {b ? <>{b.name}{b.company ? ` (${b.company})` : ""} · Tier {b.tier}</> : "Buyer"} · {dateTime(o.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {b?.pof_verified ? <Flag tone="sage">POF verified</Flag> : <Flag tone="amber">POF not verified</Flag>}
                    <Flag tone={o.status === "Accepted" ? "sage" : o.status === "Declined" ? "danger" : o.status === "New" ? "clay" : "ink"}>{o.status}</Flag>
                  </div>
                </div>
                {o.message && <p className="mt-2 rounded bg-paper p-2">{o.message}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {b?.phone && <a className="btn btn-ghost btn-sm" href={`tel:${b.phone}`}>Call</a>}
                  {b?.email && <a className="btn btn-ghost btn-sm" href={`mailto:${b.email}`}>Email</a>}
                  {canManage && (
                    <form action={setOfferStatus} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={o.id} /><input type="hidden" name="deal_id" value={dealId} />
                      <select name="status" defaultValue={o.status} className="input min-h-9 w-36 py-1 text-xs" aria-label="Offer status">
                        {["New", "Reviewed", "Accepted", "Declined"].map((s) => <option key={s}>{s}</option>)}
                      </select>
                      <SubmitButton className="btn btn-ghost btn-sm">Update</SubmitButton>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {canManage && (offers ?? []).some((o) => o.status === "Accepted") && (
        <p className="mt-3 text-xs text-ink-soft">Accepted an offer? Set that buyer as the End buyer above, collect their EMD, get the buyer disclosure signed, then mark the deal Buyer assigned.</p>
      )}
    </section>
  );
}

export async function AlertsPanel({ supabase, dealId, published, available }: { supabase: SupabaseClient; dealId: string; published: boolean; available: boolean }) {
  const matches = await matchingBuyers(dealId).catch(() => []);
  const { data: log } = await supabase.from("deal_alerts").select("status").eq("deal_id", dealId);
  const sent = (log ?? []).filter((l) => l.status === "sent").length;
  const failed = (log ?? []).filter((l) => l.status === "failed").length;
  const pendingA = matches.filter((m) => !m.already_alerted && m.tier === "A").length;
  const pendingRest = matches.filter((m) => !m.already_alerted && m.tier !== "A").length;
  const ready = published && available;

  return (
    <section id="alerts" className="card p-4 sm:p-5">
      <h2 className="mb-1 text-sm font-bold tracking-wide text-ink-soft uppercase">Deal alerts</h2>
      <p className="text-sm text-ink-soft">
        {matches.length} active buyer{matches.length === 1 ? "" : "s"} match this deal's area, price, rehab level and property type. {sent} emailed so far{failed ? `, ${failed} failed` : ""}.
      </p>
      {!emailConfigured() && <p className="mt-2 text-sm font-semibold text-amber">Email sending isn't set up yet. Add your Resend key in Vercel to turn alerts on.</p>}
      {!ready ? (
        <p className="mt-3 text-sm text-ink-soft">{!published ? "Publish the deal to the buyer portal to send alerts." : "This deal is no longer available, so alerts are off."}</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <form action={sendAlertsAction}><input type="hidden" name="deal_id" value={dealId} /><input type="hidden" name="scope" value="A" />
            <SubmitButton className="btn btn-dark btn-sm" pendingText="Sending…">Email Tier A ({pendingA})</SubmitButton></form>
          <form action={sendAlertsAction}><input type="hidden" name="deal_id" value={dealId} /><input type="hidden" name="scope" value="rest" />
            <SubmitButton className="btn btn-ghost btn-sm" pendingText="Sending…">Email everyone else ({pendingRest})</SubmitButton></form>
        </div>
      )}
      <p className="hint mt-2">Playbook: blast your best buyers (Tier A) first, then the full list. Each buyer gets one email per deal. Emails show the area and numbers; the street address unlocks only after the buyer acknowledges the disclosure in the portal.</p>
    </section>
  );
}
