import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { Notice, PageHeader } from "@/components/crm/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { OwnerData } from "@/components/crm/OwnerData";
import { LEAD_SOURCES, US_STATES } from "@/lib/constants";
import { dateShort } from "@/lib/format";
import { CREDIT_PRICE, LOOKUP_LIMIT, tracerfyConfigured, type PropertyData } from "@/lib/tracerfy";
import { createLeadFromLookup, runLookup, saveLookupToLead } from "./actions";

export const metadata = { title: "Owner lookup" };

type Params = { id?: string; lead?: string; error?: string; cached?: string; dup?: string; address?: string; city?: string; state?: string; zip?: string };
type Query = { address: string; city: string; state: string; zip: string };

export default async function LookupPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { supabase, profile } = await requireRole("owner", "acquisitions", "va");
  const sp = await searchParams;

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [{ data: monthRows }, { data: recent }, leadRes, lookupRes] = await Promise.all([
    supabase.from("property_lookups").select("credits").gt("credits", 0).gte("created_at", monthStart.toISOString()),
    supabase.from("property_lookups").select("id,created_at,query").gt("credits", 0).order("created_at", { ascending: false }).limit(8),
    sp.lead ? supabase.from("leads").select("id,seller_name,address,city,state,zip").eq("id", sp.lead).maybeSingle() : Promise.resolve({ data: null }),
    sp.id ? supabase.from("property_lookups").select("id,created_at,query,result").eq("id", sp.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const lead = leadRes.data as null | { id: string; seller_name: string; address: string; city: string | null; state: string | null; zip: string | null };
  const lookup = lookupRes.data as null | { id: string; created_at: string; query: Query; result: PropertyData };

  const used = monthRows?.length ?? 0;
  const spent = (monthRows ?? []).reduce((a, r) => a + Number(r.credits ?? 0), 0) * CREDIT_PRICE;
  const f = {
    address: sp.address ?? lookup?.query.address ?? lead?.address ?? "",
    city: sp.city ?? lookup?.query.city ?? lead?.city ?? "",
    state: sp.state ?? lookup?.query.state ?? lead?.state ?? "TX",
    zip: sp.zip ?? lookup?.query.zip ?? lead?.zip ?? "",
  };
  const fullAddress = lookup ? `${lookup.query.address}, ${lookup.query.city}, ${lookup.query.state} ${lookup.query.zip}`.trim() : "";

  return (
    <>
      {lead && <p className="mb-3 text-sm"><Link href={`/crm/leads/${lead.id}`} className="text-ink-soft underline">← Back to {lead.seller_name}</Link></p>}
      <PageHeader title="Owner lookup" sub="Type an address (like a house you found on Zillow). Get the owner, their phones and emails, the mortgage and equity, all in one." />

      {!tracerfyConfigured() && <Notice tone="amber">Owner lookup isn&apos;t connected yet. Add your Tracerfy API key in Vercel as <code>TRACERFY_API_KEY</code>, then redeploy.</Notice>}
      {sp.error && <Notice tone="danger">{sp.error}</Notice>}
      {sp.cached && <Notice>Showing your lookup from {dateShort(lookup?.created_at)}. No new charge. Use “Look up again” to refresh it.</Notice>}
      {sp.dup && (
        <div role="status" className="mb-4 flex flex-wrap items-center gap-2 rounded-lg bg-amber/10 px-4 py-3 text-sm font-medium text-amber">
          <span>You already have a lead at this address.</span>
          <Link href={`/crm/leads/${sp.dup}`} className="font-semibold underline">Open it</Link>
          {lookup && (
            <form action={saveLookupToLead}>
              <input type="hidden" name="lookup_id" value={lookup.id} />
              <input type="hidden" name="lead_id" value={sp.dup} />
              <button className="btn btn-dark btn-sm">Save this lookup to it</button>
            </form>
          )}
        </div>
      )}

      <form action={runLookup} className="card mb-5 grid gap-3 p-4 sm:grid-cols-[1fr_10rem_5rem_6.5rem_auto] sm:items-end sm:p-5">
        {lead && <input type="hidden" name="lead_id" value={lead.id} />}
        <div><label className="label" htmlFor="address">Street address</label><input id="address" name="address" className="input" defaultValue={f.address} placeholder="123 Main St" required autoComplete="off" /></div>
        <div><label className="label" htmlFor="city">City</label><input id="city" name="city" className="input" defaultValue={f.city} placeholder="Dallas" /></div>
        <div>
          <label className="label" htmlFor="state">State</label>
          <select id="state" name="state" className="input" defaultValue={f.state}>
            {US_STATES.map(([code]) => <option key={code} value={code}>{code}</option>)}
          </select>
        </div>
        <div><label className="label" htmlFor="zip">ZIP</label><input id="zip" name="zip" className="input" inputMode="numeric" defaultValue={f.zip} /></div>
        <SubmitButton pendingText="Looking up…">Look up</SubmitButton>
        <p className="col-span-full hint">
          Tip: you can paste a whole address like “123 Main St, Dallas, TX 75216” into the street box.
          {" "}{used} of {LOOKUP_LIMIT} lookups this month (about ${spent.toFixed(2)}). No charge if nothing is found, or if you look up the same address again within 30 days.
        </p>
      </form>

      {lookup ? (
        <div className="space-y-5">
          <section className="card p-4 sm:p-5">
            <p className="text-xs font-bold tracking-wide text-ink-soft uppercase">Property</p>
            <h2 className="h-display mb-4 text-xl font-semibold">{fullAddress}</h2>
            <OwnerData d={lookup.result} />
          </section>

          <section className="flex flex-wrap items-start gap-3">
            {lead ? (
              <Link href={`/crm/leads/${lead.id}`} className="btn btn-primary">Saved to {lead.seller_name}. Open lead</Link>
            ) : (
              <form action={createLeadFromLookup} className="card flex flex-wrap items-end gap-3 p-4">
                <input type="hidden" name="lookup_id" value={lookup.id} />
                <div>
                  <label className="label" htmlFor="lead_source">Lead source</label>
                  <select id="lead_source" name="lead_source" className="input" defaultValue="Zillow">
                    {LEAD_SOURCES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div><label className="label" htmlFor="asking_price">List / asking price</label><input id="asking_price" name="asking_price" className="input w-36" inputMode="numeric" placeholder="optional" /></div>
                <SubmitButton pendingText="Creating…">Create lead</SubmitButton>
              </form>
            )}
            {profile.role !== "va" && (
              <Link href={`/crm/comps${lead ? `?lead=${lead.id}` : ""}`} className="btn btn-ghost">Pull comps</Link>
            )}
            <form action={runLookup}>
              <input type="hidden" name="address" value={lookup.query.address} />
              <input type="hidden" name="city" value={lookup.query.city} />
              <input type="hidden" name="state" value={lookup.query.state} />
              <input type="hidden" name="zip" value={lookup.query.zip} />
              <input type="hidden" name="refresh" value="1" />
              {lead && <input type="hidden" name="lead_id" value={lead.id} />}
              <SubmitButton pendingText="Looking up…" className="btn btn-ghost">Look up again (new charge)</SubmitButton>
            </form>
          </section>

          <p className="rounded-lg border border-amber/40 bg-amber/10 p-3 text-sm">
            <b>Calling rules:</b> numbers on the Do Not Call list are crossed out, and litigators are flagged. Hand-dial the clean numbers.
            Don&apos;t text or auto-dial these numbers unless the owner has agreed to it. If the house is listed with an agent, go through the agent.
          </p>
        </div>
      ) : (
        recent && recent.length > 0 && (
          <section className="card p-4 sm:p-5">
            <h2 className="mb-2 text-sm font-bold tracking-wide text-ink-soft uppercase">Recent lookups</h2>
            <ul className="divide-y divide-line text-sm">
              {recent.map((r) => {
                const q = r.query as Query;
                return (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                    <Link href={`/crm/lookup?id=${r.id}${lead ? `&lead=${lead.id}` : ""}`} className="font-medium underline">{q.address}, {q.city}, {q.state}</Link>
                    <span className="shrink-0 text-ink-soft">{dateShort(r.created_at)}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )
      )}
    </>
  );
}
