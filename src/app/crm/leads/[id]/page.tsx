import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { Flag, Notice, PageHeader, StatusPill } from "@/components/crm/ui";
import { FollowUpForm } from "@/components/crm/FollowUpForm";
import { LeadForm } from "@/components/crm/LeadForm";
import { leadOwners } from "@/lib/staff";
import { CADENCE_DAYS } from "@/lib/constants";
import { dateShort, dateTime, money, phonePretty } from "@/lib/format";
import { deleteLead } from "../actions";
import { ConfirmButton } from "@/components/ConfirmButton";

export const metadata = { title: "Lead" };

export default async function LeadPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; logged?: string; error?: string }>;
}) {
  const { supabase, profile } = await requireRole("owner", "acquisitions", "va");
  const { id } = await params;
  const sp = await searchParams;

  const { data: lead } = await supabase.from("leads").select("*").eq("id", id).maybeSingle();
  if (!lead) notFound();

  const [{ data: acts }, staff, consent, deals] = await Promise.all([
    supabase.from("lead_activities").select("id,created_at,kind,reached,outcome,notes,created_by").eq("lead_id", id).order("created_at", { ascending: false }).limit(100),
    profile.role === "va" ? Promise.resolve([]) : leadOwners(supabase),
    profile.role === "owner"
      ? supabase.from("consent_records").select("created_at,consent_text,ip_address,page_url").eq("lead_id", id).order("created_at", { ascending: false })
      : Promise.resolve({ data: null }),
    profile.role === "va" ? Promise.resolve({ data: [] }) : supabase.from("deals").select("id,status,closing_date").eq("lead_id", id),
  ]);

  const names = new Map(staff.map((s) => [s.id, s.full_name ?? s.email ?? "Team"]));
  const arv = Number(lead.est_arv) || 0;
  const repairs = Number(lead.est_repairs) || 0;
  const mao70 = arv ? arv * 0.7 - repairs : null;
  const step = Math.min(lead.follow_up_step, 6);
  const analysis = (lead.analysis ?? null) as { mao?: number; verdict?: string | null; arv?: number; repairs?: number; mao_pct?: number; fee?: number; price?: number | null; analyzed_at?: string; analyzed_by?: string } | null;
  const back = `/crm/leads/${id}`;
  const canDeal = profile.role !== "va" && !["Under contract", "Closed"].includes(lead.status) && (deals.data ?? []).length === 0;

  return (
    <>
      <div className="mb-3 text-sm"><Link href="/crm/leads" className="text-ink-soft underline">← Leads</Link></div>
      <PageHeader
        title={lead.seller_name}
        sub={<>{lead.address}{lead.city ? `, ${lead.city}` : ""}{lead.state ? `, ${lead.state}` : ""} {lead.zip ?? ""}</>}
        actions={canDeal ? <Link href={`/crm/pipeline/new?lead=${id}`} className="btn btn-primary btn-sm">Put under contract</Link> : undefined}
      />
      {sp.saved && <Notice>Saved.</Notice>}
      {["Closed", "Dead"].includes(lead.status) && (
        <p className="mb-4 rounded-lg bg-paper px-4 py-3 text-sm text-ink-soft ring-1 ring-line">
          This lead is <strong className="text-ink">{lead.status}</strong>, so it's off your follow-up list and the Open leads view.
          Find it anytime under <Link href={`/crm/leads?status=${lead.status}`} className="font-semibold text-ink underline">Leads → {lead.status}</Link>.
        </p>
      )}
      {sp.logged && <Notice>Follow-up logged.</Notice>}
      {sp.error && <Notice tone="danger">{sp.error}</Notice>}

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <StatusPill status={lead.status} />
        {lead.motivation && <Flag tone={lead.motivation >= 4 ? "clay" : "ink"}>Motivation {lead.motivation}/5</Flag>}
        {lead.keep_candidate && <Flag tone="sage">Keep candidate</Flag>}
        {lead.do_not_call && <Flag tone="danger">DO NOT CALL</Flag>}
        {lead.lead_source && <Flag>{lead.lead_source}</Flag>}
        {lead.next_follow_up && <span className="text-sm text-ink-soft">Next follow-up {dateShort(lead.next_follow_up)} ({lead.follow_up_step <= 6 ? `day ${CADENCE_DAYS[step - 1]}` : "monthly"})</span>}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="order-2 lg:order-1">
          <LeadForm lead={lead} role={profile.role} staff={staff} />
        </div>

        <aside className="order-1 space-y-4 lg:order-2">
          <section className="card p-4">
            {lead.do_not_call ? (
              <p className="text-sm font-semibold text-danger">This person asked not to be contacted. Don't call, text or mail.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {lead.phone && <a href={`tel:${lead.phone}`} className="btn btn-primary btn-sm">Call {phonePretty(lead.phone)}</a>}
                {lead.phone && <a href={`sms:${lead.phone}`} className="btn btn-ghost btn-sm">Text</a>}
                {lead.email && <a href={`mailto:${lead.email}`} className="btn btn-ghost btn-sm">Email</a>}
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lead.address} ${lead.city ?? ""} ${lead.state ?? ""} ${lead.zip ?? ""}`)}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">Map</a>
              </div>
            )}
            {!lead.do_not_call && !["Under contract", "Closed", "Dead"].includes(lead.status) && (
              <details className="mt-3 border-t border-line pt-3" open={lead.status === "New"}>
                <summary className="cursor-pointer text-sm font-semibold">Log a follow-up</summary>
                <div className="mt-3"><FollowUpForm leadId={id} back={back} /></div>
              </details>
            )}
          </section>

          {profile.role !== "va" && (
            <section className="card p-4 text-sm">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Deal numbers</h2>
                {profile.role !== "dispositions" && <Link href={`/crm/analyzer?lead=${id}`} className="btn btn-dark btn-sm">Analyze</Link>}
              </div>
              {analysis?.mao != null ? (
                <>
                  <div className={`mt-3 flex items-center justify-between rounded-lg p-3 text-white ${analysis.verdict === "PASS" ? "bg-danger" : analysis.verdict === "GO" ? "bg-sage" : "bg-ink"}`}>
                    <span><span className="block text-xs opacity-80">MAO</span><span className="h-display text-2xl font-semibold">{money(analysis.mao)}</span></span>
                    {analysis.verdict && <span className="h-display text-2xl font-bold">{analysis.verdict}</span>}
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-y-1">
                    <dt className="text-ink-soft">ARV</dt><dd className="text-right">{money(analysis.arv)}</dd>
                    <dt className="text-ink-soft">Repairs</dt><dd className="text-right">{money(analysis.repairs)}</dd>
                    <dt className="text-ink-soft">MAO % · fee</dt><dd className="text-right">{analysis.mao_pct}% · {money(analysis.fee)}</dd>
                    <dt className="text-ink-soft">Price tested</dt><dd className="text-right">{money(analysis.price)}</dd>
                  </dl>
                  <p className="hint">Analyzed {dateTime(analysis.analyzed_at)}{analysis.analyzed_by ? ` by ${analysis.analyzed_by}` : ""}</p>
                </>
              ) : (
                <>
                  <dl className="mt-2 grid grid-cols-2 gap-y-1">
                    <dt className="text-ink-soft">ARV</dt><dd className="text-right">{money(lead.est_arv)}</dd>
                    <dt className="text-ink-soft">Repairs</dt><dd className="text-right">{money(lead.est_repairs)}</dd>
                    <dt className="text-ink-soft">Asking</dt><dd className="text-right">{money(lead.asking_price)}</dd>
                    <dt className="font-semibold">70% − repairs</dt><dd className="text-right font-semibold">{money(mao70)}</dd>
                  </dl>
                  <p className="hint">Run the Deal Analyzer for MAO and a GO/PASS verdict.</p>
                </>
              )}
            </section>
          )}

          {(deals.data ?? []).length > 0 && (
            <section className="card p-4 text-sm">
              <h2 className="font-semibold">Deal</h2>
              {(deals.data ?? []).map((d) => (
                <Link key={d.id} href={`/crm/pipeline/${d.id}`} className="mt-2 flex items-center justify-between underline">
                  Closing {dateShort(d.closing_date)} <StatusPill status={d.status} />
                </Link>
              ))}
            </section>
          )}

          <section className="card p-4">
            <h2 className="text-sm font-semibold">Activity</h2>
            <ol className="mt-3 space-y-3">
              {(acts ?? []).map((a) => (
                <li key={a.id} className="border-l-2 border-line pl-3 text-sm">
                  <p>
                    <span className="font-semibold capitalize">{a.kind === "system" || a.kind === "status" ? "Update" : a.kind}</span>
                    {a.reached && <span className="ml-1 text-sage">· talked</span>}
                    {a.outcome && <span className="text-ink-soft"> · {a.outcome}</span>}
                  </p>
                  {a.notes && <p className="text-ink-soft">{a.notes}</p>}
                  <p className="text-xs text-muted">{dateTime(a.created_at)}{a.created_by && names.get(a.created_by) ? ` · ${names.get(a.created_by)}` : ""}</p>
                </li>
              ))}
            </ol>
          </section>

          {consent.data && consent.data.length > 0 && (
            <section className="card p-4 text-xs text-ink-soft">
              <h2 className="text-sm font-semibold text-ink">Consent on file</h2>
              {consent.data.map((c, i) => (
                <div key={i} className="mt-2">
                  <p>Agreed {dateTime(c.created_at)} from IP {c.ip_address ?? "unknown"}</p>
                  <details><summary className="cursor-pointer underline">Wording agreed to</summary><p className="mt-1">{c.consent_text}</p></details>
                </div>
              ))}
            </section>
          )}

          {profile.role === "owner" && (
            <form action={deleteLead} className="text-right">
              <input type="hidden" name="id" value={id} />
              <ConfirmButton message="Delete this lead and its history permanently? This can't be undone.">Delete lead permanently</ConfirmButton>
            </form>
          )}
        </aside>
      </div>
    </>
  );
}
