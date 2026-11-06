import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { Notice, PageHeader } from "@/components/crm/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { getSettings } from "@/lib/settings";
import { dateShort } from "@/lib/format";
import { MONTHLY_LIMIT, rentcastConfigured, type CompsResult } from "@/lib/rentcast";
import { pullComps } from "./actions";
import { CompsResults } from "./CompsResults";

export const metadata = { title: "Comps" };

type Params = { id?: string; lead?: string; error?: string; address?: string; cached?: string };

export default async function CompsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { supabase, profile } = await requireRole("owner", "acquisitions", "dispositions");
  const { id, lead: leadId, error, address: typed, cached } = await searchParams;
  const canSendToLead = profile.role !== "dispositions";

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [settings, { count: used }, { data: recent }, leadRes, lookupRes] = await Promise.all([
    getSettings(supabase),
    supabase.from("comp_lookups").select("id", { count: "exact", head: true }).gte("created_at", monthStart.toISOString()),
    supabase.from("comp_lookups").select("id,created_at,query").order("created_at", { ascending: false }).limit(8),
    leadId && canSendToLead
      ? supabase.from("leads").select("id,address,city,state,zip,sqft,beds,baths,asking_price,offer_amount").eq("id", leadId).maybeSingle()
      : Promise.resolve({ data: null }),
    id ? supabase.from("comp_lookups").select("id,created_at,query,result").eq("id", id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const lead = leadRes.data as null | { id: string; address: string; city: string | null; state: string | null; zip: string | null; sqft: number | null; beds: number | null; baths: number | null; asking_price: number | null; offer_amount: number | null };
  const lookup = lookupRes.data as null | { id: string; created_at: string; query: { address: string; radius: string }; result: CompsResult };

  const leadAddress = lead ? [lead.address, lead.city, [lead.state, lead.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ") : "";
  const defaultAddress = typed ?? lookup?.query.address ?? leadAddress;
  const remaining = Math.max(0, MONTHLY_LIMIT - (used ?? 0));
  const rates = { Turnkey: settings.rehab_turnkey_sqft, Light: settings.rehab_light_sqft, Medium: settings.rehab_medium_sqft, Heavy: settings.rehab_heavy_sqft };

  return (
    <>
      {lead && <p className="mb-3 text-sm"><Link href={`/crm/leads/${lead.id}`} className="text-ink-soft underline">← Back to lead</Link></p>}
      <PageHeader title="Comps" sub="Type an address. We pull nearby homes, pick the good comps, and estimate ARV and your MAO." />

      {!rentcastConfigured() && (
        <Notice tone="amber">Comps aren't connected yet. Add your RentCast API key in Vercel as <code>RENTCAST_API_KEY</code>, then redeploy.</Notice>
      )}
      {error && <Notice tone="danger">{error}</Notice>}
      {cached && <Notice>Showing your lookup from {dateShort(lookup?.created_at)}. It didn't use a new lookup. Use “Pull fresh” to update it.</Notice>}

      <form action={pullComps} className="card mb-5 grid gap-3 p-4 sm:grid-cols-[1fr_8rem_auto] sm:items-end sm:p-5">
        {lead && <input type="hidden" name="lead_id" value={lead.id} />}
        <div>
          <label className="label" htmlFor="address">Property address</label>
          <input id="address" name="address" className="input" defaultValue={defaultAddress} placeholder="123 Main St, Dallas, TX 75216" required autoComplete="off" />
        </div>
        <div>
          <label className="label" htmlFor="radius">Search within</label>
          <select id="radius" name="radius" className="input" defaultValue={lookup?.query.radius ?? "1"}>
            <option value="0.5">½ mile</option>
            <option value="1">1 mile</option>
            <option value="2">2 miles</option>
          </select>
        </div>
        <SubmitButton pendingText="Pulling comps…">Pull comps</SubmitButton>
        <details className="col-span-full text-sm">
          <summary className="cursor-pointer text-ink-soft">Know the house better than the records? (optional)</summary>
          <div className="mt-3 grid grid-cols-3 gap-3 sm:max-w-md">
            <div><label className="label" htmlFor="sqft">Sq ft</label><input id="sqft" name="sqft" className="input" inputMode="numeric" defaultValue={lead?.sqft ?? ""} /></div>
            <div><label className="label" htmlFor="beds">Beds</label><input id="beds" name="beds" className="input" inputMode="numeric" defaultValue={lead?.beds ?? ""} /></div>
            <div><label className="label" htmlFor="baths">Baths</label><input id="baths" name="baths" className="input" inputMode="decimal" defaultValue={lead?.baths ?? ""} /></div>
          </div>
          <p className="hint mt-2">Filling these in always pulls a fresh lookup.</p>
        </details>
        <p className="col-span-full hint">{remaining} of {MONTHLY_LIMIT} lookups left this month. Looking up the same address again within 30 days is free.</p>
      </form>

      {lookup ? (
        <CompsResults
          key={lookup.id}
          lookupId={lookup.id}
          pulledAt={lookup.created_at}
          address={lookup.query.address}
          radius={lookup.query.radius}
          result={lookup.result}
          rates={rates}
          pct={settings.default_mao_pct}
          fee={settings.default_fee}
          price={lead?.offer_amount ?? lead?.asking_price ?? null}
          leadId={canSendToLead ? lead?.id : undefined}
          canSendToLead={canSendToLead}
        />
      ) : (
        recent && recent.length > 0 && (
          <section className="card p-4 sm:p-5">
            <h2 className="mb-2 text-sm font-bold tracking-wide text-ink-soft uppercase">Recent lookups</h2>
            <ul className="divide-y divide-line text-sm">
              {recent.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                  <Link href={`/crm/comps?id=${r.id}${lead ? `&lead=${lead.id}` : ""}`} className="font-medium underline">{(r.query as { address?: string })?.address ?? "Lookup"}</Link>
                  <span className="shrink-0 text-ink-soft">{dateShort(r.created_at)}</span>
                </li>
              ))}
            </ul>
          </section>
        )
      )}
    </>
  );
}
