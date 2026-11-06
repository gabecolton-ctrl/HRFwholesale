import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { Notice, PageHeader } from "@/components/crm/ui";
import { US_STATES } from "@/lib/constants";
import { dateShort } from "@/lib/format";
import { syncList, type LeadList } from "@/lib/distress";
import { CREDIT_PRICE, listPresets, tracerfyConfigured, type Preset } from "@/lib/tracerfy";
import { refreshLists } from "../actions";
import { DistressTabs } from "../ui";
import { ListBuilder } from "./ListBuilder";

export const metadata = { title: "Build a list" };
export const maxDuration = 60;

type Params = { started?: string; imported?: string; checked?: string; error?: string };

export default async function ListsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { supabase, profile } = await requireRole("owner", "acquisitions");
  const sp = await searchParams;

  let presets: Preset[] = [];
  let presetError = "";
  if (tracerfyConfigured()) {
    try {
      presets = await listPresets();
    } catch (e) {
      presetError = (e as Error).message;
    }
  }

  const { data } = await supabase.from("lead_lists").select("*").order("created_at", { ascending: false }).limit(25);
  // Check on lists that are still building; import any that finished.
  const lists = await Promise.all(((data ?? []) as LeadList[]).map((l) => (l.status === "processing" ? syncList(supabase, l) : l)));
  const building = lists.some((l) => l.status === "processing");

  return (
    <>
      <PageHeader title="Distress leads" sub="Pull owners in any state, county or ZIP: pre-foreclosure, vacant, tired landlords, high-equity absentee owners and more." />
      <DistressTabs canBuild isOwner={profile.role === "owner"} />

      {!tracerfyConfigured() && <Notice tone="amber">List building uses your Tracerfy account. Add <code>TRACERFY_API_KEY</code> in Vercel, then redeploy.</Notice>}
      {presetError && <Notice tone="danger">Couldn&apos;t load list types from Tracerfy: {presetError}</Notice>}
      {sp.error && <Notice tone="danger">{sp.error}</Notice>}
      {sp.started && <Notice>Your list is building. It usually takes 1–5 minutes. Tap “Check status” below, then find the houses in the Inbox.</Notice>}
      {sp.imported && <Notice>Added {sp.imported} properties to your <Link href="/crm/distress?source=list" className="underline">Inbox</Link>.</Notice>}
      {sp.checked && building && <Notice tone="amber">Still building. Check again in a minute.</Notice>}

      {tracerfyConfigured() && !presetError && <ListBuilder presets={presets} states={US_STATES} price={CREDIT_PRICE} />}

      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold tracking-wide text-ink-soft uppercase">Your lists</h2>
          {building && <form action={refreshLists}><button className="btn btn-dark btn-sm">Check status</button></form>}
        </div>
        {lists.length === 0 ? (
          <p className="card p-4 text-sm text-ink-soft">No lists yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>List</th><th>Started</th><th>Status</th><th className="text-right">Houses</th><th className="text-right">Cost</th></tr></thead>
              <tbody>
                {lists.map((l) => (
                  <tr key={l.id}>
                    <td className="font-medium">{l.name}{l.error && l.status !== "imported" && <span className="block text-xs text-danger">{l.error}</span>}</td>
                    <td className="whitespace-nowrap">{dateShort(l.created_at)}</td>
                    <td>{{ pending: "Starting", processing: "Building…", completed: "Importing", imported: "In your Inbox", failed: "Failed" }[l.status]}</td>
                    <td className="text-right tabular-nums">{l.status === "imported" ? <Link className="underline" href="/crm/distress?source=list">{l.rows_imported.toLocaleString()}</Link> : `up to ${l.requested_count.toLocaleString()}`}</td>
                    <td className="text-right tabular-nums">{l.credits ? `$${(l.credits * CREDIT_PRICE).toFixed(2)}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="hint mt-2">Tracerfy allows 10 list builds an hour. Houses already in a list you bought won&apos;t be added twice from the same list.</p>
      </section>
    </>
  );
}
